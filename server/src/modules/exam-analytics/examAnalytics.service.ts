import { Prisma, ExamAttemptEventType } from '@prisma/client';

import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { facility, median, discrimination27 } from '../exam/examStats';

// Events that signal a student may have lost focus / acted suspiciously during
// an attempt — used as one input to the per-student risk score (PDF §3).
const VIOLATION_EVENTS: ExamAttemptEventType[] = [
  ExamAttemptEventType.TAB_HIDDEN,
  ExamAttemptEventType.WINDOW_BLUR,
  ExamAttemptEventType.COPY,
  ExamAttemptEventType.PASTE,
  ExamAttemptEventType.CONTEXT_MENU,
  ExamAttemptEventType.SHORTCUT_BLOCKED,
];

// ════════════════════════════════════════════════════════════════════
// Exam Analytics Engine (Advanced Reporting upgrade — PDF §3, §5)
//
// Computes per-exam item analysis, option/distractor distribution, topic
// mastery and an exam summary, then caches the result in the snapshot tables
// (ExamReportSnapshot / QuestionStat / QuestionOptionStat / TopicPerformanceStat).
// Reads are served from the cache and recomputed on demand when a snapshot is
// missing or marked STALE (invalidation happens on submit / grade / delete).
//
// Scope note: analytics are computed for the whole exam (classId = 0). Per-class
// scoping is reserved for a later phase; the classId column already supports it.
// ════════════════════════════════════════════════════════════════════

const COMPLETED = ['SUBMITTED', 'GRADED'] as const;
const ALL_CLASSES = 0; // sentinel: snapshot covers every assigned class

type AnswerRow = {
  questionId: number;
  isCorrect: boolean;
  manualScore: Prisma.Decimal | null;
  answerText: string | null;
  selectedOptionId: number | null;
  selectedOptionIds: Prisma.JsonValue;
  timeSpentSec: number | null;
};

function earnedScore(ans: AnswerRow | undefined, points: number): number {
  if (!ans) return 0;
  if (ans.manualScore !== null && ans.manualScore !== undefined) return Number(ans.manualScore);
  return ans.isCorrect ? points : 0;
}

function isAnswered(ans: AnswerRow | undefined): boolean {
  if (!ans) return false;
  if (ans.answerText != null && ans.answerText.trim() !== '') return true;
  if (ans.selectedOptionId != null) return true;
  if (Array.isArray(ans.selectedOptionIds) && ans.selectedOptionIds.length > 0) return true;
  return false;
}

function selectedOptionIds(ans: AnswerRow | undefined): number[] {
  if (!ans) return [];
  const ids: number[] = [];
  if (ans.selectedOptionId != null) ids.push(ans.selectedOptionId);
  if (Array.isArray(ans.selectedOptionIds)) {
    for (const v of ans.selectedOptionIds) if (typeof v === 'number') ids.push(v);
  }
  return [...new Set(ids)];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

// Map facility (mean fraction of points earned) to a difficulty label (PDF §3).
export function difficultyLabel(facilityValue: number | null): string {
  if (facilityValue === null) return 'unknown';
  if (facilityValue >= 0.85) return 'very_easy';
  if (facilityValue >= 0.65) return 'easy';
  if (facilityValue >= 0.4) return 'medium';
  if (facilityValue >= 0.2) return 'hard';
  return 'very_hard';
}

// Question quality flag from the PDF recommended thresholds (§3).
// correctRate is the share of *all* completed attempts that earned full marks.
function qualityFlag(
  correctRate: number,
  discrimination: number | null,
  attemptsN: number,
): string {
  if (attemptsN < 5) return 'insufficient_data';
  if (correctRate >= 0.9) return 'too_easy';
  if (correctRate <= 0.3) return 'too_hard';
  if (discrimination !== null && discrimination < 0.1) return 'needs_review';
  if (correctRate >= 0.4 && correctRate <= 0.85 && discrimination !== null && discrimination >= 0.2) {
    return 'good';
  }
  return 'ok';
}

// Per-student risk score 0–100 (higher = more at risk), a weighted blend of:
// low score vs the passing/half mark, low per-exam topic mastery, auto-submission
// (ran out of time), and focus-loss / suspicious events. PDF §3 "Student Risk".
function computeRisk(input: {
  score: number;
  maxScore: number;
  passing: number | null;
  masteryFraction: number; // 0..1 over answered questions on this exam
  isAutoSubmitted: boolean;
  violationCount: number;
}): { riskScore: number; riskLevel: string } {
  const { score, maxScore, passing, masteryFraction, isAutoSubmitted, violationCount } = input;

  let scoreRisk = 0;
  if (passing !== null && passing > 0) {
    if (score < passing) scoreRisk = Math.min(40, (40 * (passing - score)) / passing);
  } else if (maxScore > 0) {
    const half = 0.5 * maxScore;
    if (score < half) scoreRisk = (40 * (half - score)) / half;
  }

  const masteryRisk = masteryFraction < 0.6 ? (30 * (0.6 - masteryFraction)) / 0.6 : 0;
  const submitRisk = isAutoSubmitted ? 15 : 0;
  const violationRisk = Math.min(15, violationCount * 3);

  const riskScore = Math.min(100, Math.round(scoreRisk + masteryRisk + submitRisk + violationRisk));

  // "Needs Support" override: below passing AND weak mastery (PDF threshold).
  const needsSupport = passing !== null && score < passing && masteryFraction < 0.5;

  let riskLevel = 'none';
  if (needsSupport || riskScore >= 60) riskLevel = 'high';
  else if (riskScore >= 35) riskLevel = 'medium';
  else if (riskScore >= 15) riskLevel = 'low';

  return { riskScore, riskLevel };
}

export class ExamAnalyticsService {
  /** Ownership guard mirroring ExamReportService.assertExamOwner. */
  async assertExamOwner(examId: number, userId: number, role: string): Promise<void> {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, ...(role === 'admin' ? {} : { createdBy: userId }) },
      select: { id: true },
    });
    if (!exam) throw new AppError('Exam not found or unauthorized', 404);
  }

  // ────────────────────────────────────────────────────────────────
  // COMPUTE PIPELINE (PDF §5) — writes the snapshot cache tables.
  // ────────────────────────────────────────────────────────────────
  async computeExamAnalytics(examId: number): Promise<void> {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        passingScore: true,
        examQuestions: {
          orderBy: { orderIndex: 'asc' },
          select: {
            questionId: true,
            orderIndex: true,
            points: true,
            question: {
              select: {
                questionType: true,
                subjectId: true,
                chapterId: true,
                topicId: true,
                topic: {
                  select: {
                    name: true,
                    chapter: { select: { name: true, subject: { select: { name: true } } } },
                  },
                },
                options: { select: { id: true, label: true, isCorrect: true } },
              },
            },
          },
        },
        examAssignments: { select: { classId: true } },
      },
    });
    if (!exam) throw new AppError('Exam not found', 404);

    // Assigned-student denominator for completion rate (distinct across classes).
    const assignmentClassIds = exam.examAssignments.map((a) => a.classId);
    const assignedRows = assignmentClassIds.length
      ? await prisma.classStudent.findMany({
          where: { classId: { in: assignmentClassIds } },
          select: { studentId: true },
        })
      : [];
    const assignedCount = new Set(assignedRows.map((r) => r.studentId)).size;

    const attempts = await prisma.examAttempt.findMany({
      where: { examId, status: { in: [...COMPLETED] } },
      select: {
        id: true,
        studentId: true,
        totalScore: true,
        isAutoSubmitted: true,
        timeSpentSec: true,
        attemptAnswers: {
          select: {
            questionId: true,
            isCorrect: true,
            manualScore: true,
            answerText: true,
            selectedOptionId: true,
            selectedOptionIds: true,
            timeSpentSec: true,
          },
        },
      },
    });

    const questions = exam.examQuestions;
    const pointsByQ = new Map<number, number>();
    questions.forEach((eq) => pointsByQ.set(eq.questionId, Number(eq.points)));
    const maxScore = questions.reduce((s, eq) => s + Number(eq.points), 0);
    const attemptsN = attempts.length;

    // Per-attempt: answer lookup + total score (used for ranking / distribution).
    const perAttempt = attempts.map((a) => {
      const byQ = new Map<number, AnswerRow>();
      a.attemptAnswers.forEach((ans) => byQ.set(ans.questionId, ans as AnswerRow));
      let total = 0;
      for (const eq of questions) total += earnedScore(byQ.get(eq.questionId), pointsByQ.get(eq.questionId) ?? 0);
      return {
        attemptId: a.id,
        studentId: a.studentId,
        isAutoSubmitted: a.isAutoSubmitted,
        byQ,
        total: round2(total),
      };
    });
    const totals = perAttempt.map((p) => p.total);

    // ── Exam summary ──────────────────────────────────────────────
    const passing = exam.passingScore !== null ? Number(exam.passingScore) : null;
    const passedCount = passing !== null ? totals.filter((t) => t >= passing).length : 0;
    const timeValues = attempts.map((a) => a.timeSpentSec).filter((t): t is number => t != null);

    const distribution = Array.from({ length: 10 }, (_, i) => ({ bucket: `${i}-${i + 1}`, count: 0 }));
    for (const total of totals) {
      const normalized = maxScore > 0 ? (total / maxScore) * 10 : 0;
      distribution[Math.min(9, Math.max(0, Math.floor(normalized)))].count += 1;
    }

    const summary = {
      totalAttempts: attemptsN,
      assignedCount,
      completionRate: assignedCount > 0 ? round2((attemptsN / assignedCount) * 100) : null,
      maxScore: round2(maxScore),
      totalQuestions: questions.length,
      avgScore: attemptsN ? round2(avg(totals)) : null,
      medianScore: median(totals),
      minScore: attemptsN ? round2(Math.min(...totals)) : null,
      maxScoreAchieved: attemptsN ? round2(Math.max(...totals)) : null,
      passingScore: passing,
      passRate: passing !== null && attemptsN ? round2((passedCount / attemptsN) * 100) : null,
      avgTimeSec: timeValues.length ? Math.round(avg(timeValues)) : null,
    };

    // ── Per-question metrics + option distribution ────────────────
    const questionStats: Prisma.QuestionStatCreateManyInput[] = [];
    const optionStats: Prisma.QuestionOptionStatCreateManyInput[] = [];

    for (const eq of questions) {
      const points = pointsByQ.get(eq.questionId) ?? 0;
      const fractions: number[] = []; // earned fraction per attempt (for discrimination)
      const times: number[] = [];
      let answeredN = 0;
      let correctN = 0;
      const optionSelected = new Map<number, number>();
      eq.question.options.forEach((o) => optionSelected.set(o.id, 0));

      for (const p of perAttempt) {
        const ans = p.byQ.get(eq.questionId);
        const earned = earnedScore(ans, points);
        fractions.push(points > 0 ? earned / points : 0);
        if (points > 0 && earned >= points) correctN += 1;
        if (isAnswered(ans)) {
          answeredN += 1;
          for (const oid of selectedOptionIds(ans)) {
            if (optionSelected.has(oid)) optionSelected.set(oid, (optionSelected.get(oid) ?? 0) + 1);
          }
        }
        if (ans?.timeSpentSec != null) times.push(ans.timeSpentSec);
      }

      const correctRate = attemptsN ? correctN / attemptsN : 0;
      const skippedRate = attemptsN ? (attemptsN - answeredN) / attemptsN : 0;
      const facilityValue = facility(
        perAttempt.map((p) => earnedScore(p.byQ.get(eq.questionId), points)),
        points,
      );
      const discrimination = discrimination27(fractions, totals);

      questionStats.push({
        examId,
        questionId: eq.questionId,
        attempts: attemptsN,
        correctRate: round4(correctRate),
        skippedRate: round4(skippedRate),
        avgTimeSec: times.length ? Math.round(avg(times)) : 0,
        difficultyIndex: facilityValue ?? 0,
        discriminationIndex: discrimination,
        qualityFlag: qualityFlag(correctRate, discrimination, attemptsN),
      });

      // Option / distractor distribution (choice questions only).
      const correctRateForOpts = correctRate;
      for (const o of eq.question.options) {
        const selectedCount = optionSelected.get(o.id) ?? 0;
        const selectedRate = attemptsN ? selectedCount / attemptsN : 0;
        let distractorFlag: string | null = null;
        if (!o.isCorrect) {
          if (attemptsN >= 5 && selectedCount === 0) distractorFlag = 'never_selected';
          else if (selectedRate > correctRateForOpts && selectedRate >= 0.25) distractorFlag = 'too_attractive';
        }
        optionStats.push({
          examId,
          questionId: eq.questionId,
          optionId: o.id,
          selectedCount,
          selectedRate: round4(selectedRate),
          isCorrect: o.isCorrect,
          distractorFlag,
        });
      }
    }

    // ── Topic mastery (PDF §3) ────────────────────────────────────
    type TopicAgg = {
      subjectId: number;
      chapterId: number;
      topicId: number;
      name: string;
      chapterName: string;
      subjectName: string;
      correct: number;
      total: number;
    };
    const topicMap = new Map<number, TopicAgg>();
    for (const eq of questions) {
      const points = pointsByQ.get(eq.questionId) ?? 0;
      const tid = eq.question.topicId;
      if (!topicMap.has(tid)) {
        topicMap.set(tid, {
          subjectId: eq.question.subjectId,
          chapterId: eq.question.chapterId,
          topicId: tid,
          name: eq.question.topic.name,
          chapterName: eq.question.topic.chapter.name,
          subjectName: eq.question.topic.chapter.subject.name,
          correct: 0,
          total: 0,
        });
      }
      const agg = topicMap.get(tid)!;
      for (const p of perAttempt) {
        const ans = p.byQ.get(eq.questionId);
        if (!isAnswered(ans)) continue;
        agg.total += 1;
        if (points > 0 && earnedScore(ans, points) >= points) agg.correct += 1;
      }
    }
    const topicStats: Prisma.TopicPerformanceStatCreateManyInput[] = [];
    const topicSummary = [...topicMap.values()].map((t) => {
      const masteryRate = t.total ? round2((t.correct / t.total) * 100) : 0;
      topicStats.push({
        examId,
        classId: ALL_CLASSES,
        subjectId: t.subjectId,
        chapterId: t.chapterId,
        topicId: t.topicId,
        masteryRate,
        correctCount: t.correct,
        totalCount: t.total,
      });
      return {
        topicId: t.topicId,
        topicName: t.name,
        chapterName: t.chapterName,
        subjectName: t.subjectName,
        masteryRate,
        correctCount: t.correct,
        totalCount: t.total,
        weak: t.total > 0 && masteryRate < 60,
      };
    });
    topicSummary.sort((a, b) => a.masteryRate - b.masteryRate);

    // ── Submission timeline (by calendar day) ─────────────────────
    const timelineRows = await prisma.examAttempt.findMany({
      where: { examId, status: { in: [...COMPLETED] }, submittedAt: { not: null } },
      select: { submittedAt: true },
      orderBy: { submittedAt: 'asc' },
    });
    const timelineMap = new Map<string, number>();
    for (const r of timelineRows) {
      const day = r.submittedAt!.toISOString().slice(0, 10);
      timelineMap.set(day, (timelineMap.get(day) ?? 0) + 1);
    }
    const timeline = [...timelineMap.entries()].map(([date, count]) => ({ date, count }));

    // ── Per-student insights: risk score + weak topics (PDF §3) ───
    const attemptIds = attempts.map((a) => a.id);
    const violationGroups = attemptIds.length
      ? await prisma.examAttemptEvent.groupBy({
          by: ['attemptId'],
          where: { attemptId: { in: attemptIds }, type: { in: VIOLATION_EVENTS } },
          _count: { _all: true },
        })
      : [];
    const violationByAttempt = new Map(violationGroups.map((g) => [g.attemptId, g._count._all]));

    const studentInsights: Prisma.StudentExamInsightCreateManyInput[] = [];
    for (const p of perAttempt) {
      const topicAgg = new Map<number, { name: string; correct: number; total: number }>();
      let answeredTotal = 0;
      let answeredCorrect = 0;
      for (const eq of questions) {
        const ans = p.byQ.get(eq.questionId);
        if (!isAnswered(ans)) continue;
        const points = pointsByQ.get(eq.questionId) ?? 0;
        const full = points > 0 && earnedScore(ans, points) >= points;
        answeredTotal += 1;
        if (full) answeredCorrect += 1;
        const tid = eq.question.topicId;
        const entry = topicAgg.get(tid) ?? { name: eq.question.topic.name, correct: 0, total: 0 };
        entry.total += 1;
        if (full) entry.correct += 1;
        topicAgg.set(tid, entry);
      }

      const masteryFraction = answeredTotal > 0 ? answeredCorrect / answeredTotal : 0;
      const topicList = [...topicAgg.entries()].map(([topicId, t]) => ({
        topicId,
        topicName: t.name,
        masteryRate: t.total ? round2((t.correct / t.total) * 100) : 0,
      }));
      const weakTopics = topicList
        .filter((t) => t.masteryRate < 60)
        .sort((a, b) => a.masteryRate - b.masteryRate);
      const strengths = topicList
        .filter((t) => t.masteryRate >= 80)
        .sort((a, b) => b.masteryRate - a.masteryRate);

      const violationCount = violationByAttempt.get(p.attemptId) ?? 0;
      const { riskScore, riskLevel } = computeRisk({
        score: p.total,
        maxScore,
        passing,
        masteryFraction,
        isAutoSubmitted: p.isAutoSubmitted,
        violationCount,
      });

      const recommendations: string[] = [];
      if (passing !== null && p.total < passing) {
        recommendations.push('Scored below the passing mark — schedule a remediation session.');
      }
      if (weakTopics.length > 0) {
        recommendations.push(
          `Review and practise: ${weakTopics.slice(0, 3).map((t) => t.topicName).join(', ')}.`,
        );
      }
      if (p.isAutoSubmitted) {
        recommendations.push('Ran out of time (auto-submitted) — work on pacing.');
      }
      if (violationCount >= 3) {
        recommendations.push('Several focus-loss events during the exam — review exam conditions.');
      }
      if (recommendations.length === 0) {
        recommendations.push('Performing well — keep it up.');
      }

      studentInsights.push({
        attemptId: p.attemptId,
        studentId: p.studentId,
        examId,
        riskLevel,
        riskScore,
        weakTopicsJson: weakTopics as unknown as Prisma.InputJsonValue,
        strengthsJson: strengths as unknown as Prisma.InputJsonValue,
        recommendationsJson: recommendations as unknown as Prisma.InputJsonValue,
      });
    }

    // ── Persist snapshot (delete-then-insert stats, upsert summary) ─
    await prisma.$transaction([
      prisma.questionStat.deleteMany({ where: { examId } }),
      prisma.questionOptionStat.deleteMany({ where: { examId } }),
      prisma.topicPerformanceStat.deleteMany({ where: { examId } }),
      prisma.studentExamInsight.deleteMany({ where: { examId } }),
      prisma.questionStat.createMany({ data: questionStats }),
      prisma.questionOptionStat.createMany({ data: optionStats }),
      prisma.topicPerformanceStat.createMany({ data: topicStats }),
      prisma.studentExamInsight.createMany({ data: studentInsights }),
      prisma.examReportSnapshot.upsert({
        where: { examId_classId: { examId, classId: ALL_CLASSES } },
        create: {
          examId,
          classId: ALL_CLASSES,
          status: 'READY',
          generatedAt: new Date(),
          summaryJson: summary as Prisma.InputJsonValue,
          scoreDistributionJson: { distribution, timeline } as Prisma.InputJsonValue,
          topicSummaryJson: topicSummary as unknown as Prisma.InputJsonValue,
        },
        update: {
          status: 'READY',
          generatedAt: new Date(),
          summaryJson: summary as Prisma.InputJsonValue,
          scoreDistributionJson: { distribution, timeline } as Prisma.InputJsonValue,
          topicSummaryJson: topicSummary as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
  }

  /** Recompute when the snapshot is missing or not READY (or when forced). */
  private async ensureSnapshot(examId: number, refresh = false): Promise<void> {
    if (!refresh) {
      const snap = await prisma.examReportSnapshot.findUnique({
        where: { examId_classId: { examId, classId: ALL_CLASSES } },
        select: { status: true },
      });
      if (snap && snap.status === 'READY') return;
    }
    await this.computeExamAnalytics(examId);
  }

  // ────────────────────────────────────────────────────────────────
  // READ ENDPOINTS
  // ────────────────────────────────────────────────────────────────
  async getSummary(examId: number, userId: number, role: string, refresh = false) {
    await this.assertExamOwner(examId, userId, role);
    await this.ensureSnapshot(examId, refresh);
    const [exam, snap] = await Promise.all([
      prisma.exam.findUnique({
        where: { id: examId },
        select: { id: true, title: true, durationMin: true },
      }),
      prisma.examReportSnapshot.findUnique({
        where: { examId_classId: { examId, classId: ALL_CLASSES } },
      }),
    ]);
    return {
      exam,
      generatedAt: snap?.generatedAt ?? null,
      summary: snap?.summaryJson ?? null,
      scoreDistribution: snap?.scoreDistributionJson ?? null,
    };
  }

  async getQuestions(examId: number, userId: number, role: string, refresh = false) {
    await this.assertExamOwner(examId, userId, role);
    await this.ensureSnapshot(examId, refresh);

    const [stats, optStats, eqs] = await Promise.all([
      prisma.questionStat.findMany({ where: { examId } }),
      prisma.questionOptionStat.findMany({ where: { examId } }),
      prisma.examQuestion.findMany({
        where: { examId },
        orderBy: { orderIndex: 'asc' },
        select: {
          questionId: true,
          orderIndex: true,
          points: true,
          question: {
            select: {
              content: true,
              questionType: true,
              explanation: true,
              topic: { select: { id: true, name: true } },
              options: {
                orderBy: { label: 'asc' },
                select: { id: true, label: true, content: true, isCorrect: true },
              },
            },
          },
        },
      }),
    ]);

    const statByQ = new Map(stats.map((s) => [s.questionId, s]));
    const optByQ = new Map<number, typeof optStats>();
    for (const o of optStats) {
      const arr = optByQ.get(o.questionId) ?? [];
      arr.push(o);
      optByQ.set(o.questionId, arr);
    }

    return eqs.map((eq) => {
      const stat = statByQ.get(eq.questionId);
      const optStatById = new Map((optByQ.get(eq.questionId) ?? []).map((o) => [o.optionId, o]));
      const facilityValue = stat ? stat.difficultyIndex : null;
      return {
        questionId: eq.questionId,
        orderIndex: eq.orderIndex,
        points: Number(eq.points),
        content: eq.question.content,
        questionType: eq.question.questionType,
        explanation: eq.question.explanation,
        topic: eq.question.topic,
        attempts: stat?.attempts ?? 0,
        correctRate: stat ? Math.round(stat.correctRate * 1000) / 10 : null, // → percentage
        skippedRate: stat ? Math.round(stat.skippedRate * 1000) / 10 : null,
        avgTimeSec: stat?.avgTimeSec ?? null,
        difficultyIndex: facilityValue,
        difficultyLabel: difficultyLabel(facilityValue),
        discrimination: stat?.discriminationIndex ?? null,
        qualityFlag: stat?.qualityFlag ?? 'insufficient_data',
        options: eq.question.options.map((o) => {
          const os = optStatById.get(o.id);
          return {
            id: o.id,
            label: o.label,
            content: o.content,
            isCorrect: o.isCorrect,
            selectedCount: os?.selectedCount ?? 0,
            selectedRate: os ? Math.round(os.selectedRate * 1000) / 10 : 0, // → percentage
            distractorFlag: os?.distractorFlag ?? null,
          };
        }),
      };
    });
  }

  async getTopics(examId: number, userId: number, role: string, refresh = false) {
    await this.assertExamOwner(examId, userId, role);
    await this.ensureSnapshot(examId, refresh);
    const snap = await prisma.examReportSnapshot.findUnique({
      where: { examId_classId: { examId, classId: ALL_CLASSES } },
      select: { topicSummaryJson: true },
    });
    return snap?.topicSummaryJson ?? [];
  }

  /**
   * Student performance / ranking for an exam. Phase 1 returns score-based
   * ranking; Phase 3 enriches each row with risk level + weak topics from
   * StudentExamInsight.
   */
  async getStudents(examId: number, userId: number, role: string, refresh = false) {
    await this.assertExamOwner(examId, userId, role);
    await this.ensureSnapshot(examId, refresh);
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { passingScore: true },
    });
    const passing = exam?.passingScore != null ? Number(exam.passingScore) : null;

    const attempts = await prisma.examAttempt.findMany({
      where: { examId, status: { in: [...COMPLETED] } },
      orderBy: { totalScore: 'desc' },
      select: {
        id: true,
        totalScore: true,
        timeSpentSec: true,
        submittedAt: true,
        isAutoSubmitted: true,
        student: {
          select: {
            id: true,
            fullName: true,
            username: true,
            studentProfile: { select: { studentCode: true } },
          },
        },
      },
    });

    const insights = await prisma.studentExamInsight.findMany({
      where: { examId },
      select: {
        attemptId: true,
        riskLevel: true,
        riskScore: true,
        weakTopicsJson: true,
        recommendationsJson: true,
      },
    });
    const insightByAttempt = new Map(insights.map((i) => [i.attemptId, i]));

    return attempts.map((a, i) => {
      const score = a.totalScore != null ? Number(a.totalScore) : 0;
      const insight = insightByAttempt.get(a.id);
      return {
        rank: i + 1,
        attemptId: a.id,
        student: {
          id: a.student.id,
          name: a.student.fullName,
          username: a.student.username,
          studentCode: a.student.studentProfile?.studentCode ?? null,
        },
        score: round2(score),
        passed: passing !== null ? score >= passing : null,
        timeSpentSec: a.timeSpentSec,
        submittedAt: a.submittedAt,
        isAutoSubmitted: a.isAutoSubmitted,
        riskLevel: insight?.riskLevel ?? 'none',
        riskScore: insight?.riskScore ?? null,
        weakTopics: (insight?.weakTopicsJson as unknown) ?? [],
        recommendations: (insight?.recommendationsJson as unknown) ?? [],
      };
    });
  }

  async recalculate(examId: number, userId: number, role: string) {
    await this.assertExamOwner(examId, userId, role);
    await this.computeExamAnalytics(examId);
    const snap = await prisma.examReportSnapshot.findUnique({
      where: { examId_classId: { examId, classId: ALL_CLASSES } },
      select: { generatedAt: true, status: true },
    });
    return { status: snap?.status ?? 'READY', generatedAt: snap?.generatedAt ?? new Date() };
  }

  async getStatus(examId: number, userId: number, role: string) {
    await this.assertExamOwner(examId, userId, role);
    const snap = await prisma.examReportSnapshot.findUnique({
      where: { examId_classId: { examId, classId: ALL_CLASSES } },
      select: { status: true, generatedAt: true },
    });
    return {
      status: snap?.status ?? 'NONE',
      generatedAt: snap?.generatedAt ?? null,
      cached: snap?.status === 'READY',
    };
  }
}

export const examAnalyticsService = new ExamAnalyticsService();

/**
 * Mark an exam's cached analytics stale so the next read recomputes them.
 * Called after submit / manual grade / attempt deletion. Best-effort.
 */
export async function invalidateExamAnalytics(examId: number): Promise<void> {
  try {
    await prisma.examReportSnapshot.updateMany({
      where: { examId },
      data: { status: 'STALE' },
    });
  } catch (err) {
    logger.warn('Failed to invalidate exam analytics cache:', err);
  }
}
