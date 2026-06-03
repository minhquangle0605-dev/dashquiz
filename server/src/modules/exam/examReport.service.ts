import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { invalidateStudentCache } from '../analytics/analytics.service';
import { pearson, median, facility } from './examStats';
import type { GradeAnswerInput } from './exam.validation';

const COMPLETED = ['SUBMITTED', 'GRADED'] as const;

type AnswerRow = {
  id: number;
  questionId: number;
  isCorrect: boolean;
  manualScore: Prisma.Decimal | null;
  manualFeedback: string | null;
  gradedAt: Date | null;
  answerText: string | null;
  selectedOptionId: number | null;
  selectedOptionIds: Prisma.JsonValue;
};

type OptionRow = { id: number; label: string; content: string; isCorrect: boolean };

function effectiveScore(answer: AnswerRow | undefined, points: number): number {
  if (!answer) return 0;
  if (answer.manualScore !== null && answer.manualScore !== undefined) {
    return Number(answer.manualScore);
  }
  return answer.isCorrect ? points : 0;
}

function selectedIds(answer: AnswerRow): number[] {
  if (Array.isArray(answer.selectedOptionIds)) {
    return answer.selectedOptionIds.filter((id): id is number => typeof id === 'number');
  }
  return answer.selectedOptionId !== null ? [answer.selectedOptionId] : [];
}

function formatResponse(
  questionType: string,
  answer: AnswerRow | undefined,
  optionMap: Map<number, OptionRow>,
): string {
  if (!answer) return '';
  if (questionType === 'SHORT_ANSWER') return answer.answerText?.trim() ?? '';
  if (questionType === 'MATCHING') {
    try {
      const obj = answer.answerText ? (JSON.parse(answer.answerText) as Record<string, string>) : {};
      return Object.entries(obj)
        .map(([k, v]) => `${k} → ${v}`)
        .join('; ');
    } catch {
      return answer.answerText ?? '';
    }
  }
  return selectedIds(answer)
    .map((id) => {
      const opt = optionMap.get(id);
      return opt ? opt.label : String(id);
    })
    .join(', ');
}

function formatCorrect(
  questionType: string,
  options: OptionRow[],
): string {
  if (questionType === 'SHORT_ANSWER' || questionType === 'MATCHING') {
    return options
      .filter((o) => o.isCorrect || questionType === 'MATCHING')
      .map((o) => o.content)
      .join(questionType === 'MATCHING' ? '; ' : ' | ');
  }
  return options
    .filter((o) => o.isCorrect)
    .map((o) => o.label)
    .join(', ');
}

export class ExamReportService {
  private async assertExamOwner(examId: number, userId: number, role: string) {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, ...(role === 'admin' ? {} : { createdBy: userId }) },
      select: { id: true },
    });
    if (!exam) throw new AppError('Exam not found or unauthorized', 404);
  }

  // ═══════════════════════════════════════════════
  // FULL REPORT — powers Grades / Responses / Statistics / Manual tabs
  // ═══════════════════════════════════════════════
  async getReport(examId: number, userId: number, role: string) {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, ...(role === 'admin' ? {} : { createdBy: userId }) },
      select: {
        id: true,
        title: true,
        durationMin: true,
        passingScore: true,
        examQuestions: {
          orderBy: { orderIndex: 'asc' },
          select: {
            questionId: true,
            orderIndex: true,
            points: true,
            question: {
              select: {
                content: true,
                questionType: true,
                options: {
                  orderBy: { label: 'asc' },
                  select: { id: true, label: true, content: true, isCorrect: true },
                },
              },
            },
          },
        },
      },
    });

    if (!exam) throw new AppError('Exam not found or unauthorized', 404);

    const attempts = await prisma.examAttempt.findMany({
      where: { examId, status: { in: [...COMPLETED] } },
      orderBy: [{ startedAt: 'asc' }],
      select: {
        id: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        timeSpentSec: true,
        isAutoSubmitted: true,
        student: {
          select: {
            id: true,
            fullName: true,
            username: true,
            studentProfile: { select: { studentCode: true } },
          },
        },
        attemptAnswers: {
          select: {
            id: true,
            questionId: true,
            isCorrect: true,
            manualScore: true,
            manualFeedback: true,
            gradedAt: true,
            answerText: true,
            selectedOptionId: true,
            selectedOptionIds: true,
          },
        },
      },
    });

    const pointsByQ = new Map<number, number>();
    const optionMapByQ = new Map<number, Map<number, OptionRow>>();
    const questions = exam.examQuestions.map((eq) => {
      const points = Number(eq.points);
      pointsByQ.set(eq.questionId, points);
      const optMap = new Map<number, OptionRow>();
      eq.question.options.forEach((o) => optMap.set(o.id, o));
      optionMapByQ.set(eq.questionId, optMap);
      return {
        questionId: eq.questionId,
        orderIndex: eq.orderIndex,
        content: eq.question.content,
        questionType: eq.question.questionType,
        points,
        correctText: formatCorrect(eq.question.questionType, eq.question.options),
      };
    });

    const maxScore = questions.reduce((s, q) => s + q.points, 0);

    // Per-attempt rows aligned to question order.
    const attemptRows = attempts.map((attempt) => {
      const byQ = new Map<number, AnswerRow>();
      attempt.attemptAnswers.forEach((a) => byQ.set(a.questionId, a as AnswerRow));

      let total = 0;
      const answers = exam.examQuestions.map((eq) => {
        const ans = byQ.get(eq.questionId);
        const points = pointsByQ.get(eq.questionId) ?? 0;
        const score = effectiveScore(ans, points);
        total += score;
        return {
          questionId: eq.questionId,
          answerId: ans?.id ?? null,
          score,
          max: points,
          isCorrect: ans?.isCorrect ?? false,
          manualScore: ans?.manualScore != null ? Number(ans.manualScore) : null,
          manualFeedback: ans?.manualFeedback ?? null,
          graded: ans?.gradedAt != null,
          needsManual: eq.question.questionType === 'SHORT_ANSWER',
          response: formatResponse(
            eq.question.questionType,
            ans,
            optionMapByQ.get(eq.questionId) ?? new Map(),
          ),
        };
      });

      return {
        attemptId: attempt.id,
        student: {
          id: attempt.student.id,
          name: attempt.student.fullName,
          username: attempt.student.username,
          studentCode: attempt.student.studentProfile?.studentCode ?? null,
        },
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        timeSpentSec: attempt.timeSpentSec,
        isAutoSubmitted: attempt.isAutoSubmitted,
        totalScore: Math.round(total * 100) / 100,
        answers,
      };
    });

    // Statistics per question.
    const totals = attemptRows.map((r) => r.totalScore);
    const statistics = questions.map((q) => {
      const qScores = attemptRows.map(
        (r) => r.answers.find((a) => a.questionId === q.questionId)?.score ?? 0,
      );
      const n = qScores.length;
      const correctCount = qScores.filter((s) => q.points > 0 && s >= q.points).length;
      const facilityValue = facility(qScores, q.points);
      const discrimination = pearson(qScores, totals);

      const flags: string[] = [];
      if (n < 5) flags.push('insufficient_data');
      if (facilityValue !== null && facilityValue >= 0.85) flags.push('too_easy');
      if (facilityValue !== null && facilityValue <= 0.2) flags.push('too_hard');
      if (n >= 5 && discrimination !== null && discrimination < 0.1) {
        flags.push('low_discrimination');
      }

      return {
        questionId: q.questionId,
        orderIndex: q.orderIndex,
        attempts: n,
        correctCount,
        facility: facilityValue,
        discrimination,
        flags,
      };
    });

    // Score distribution normalised to a /10 scale, 10 buckets.
    const distribution = Array.from({ length: 10 }, (_, i) => ({
      bucket: `${i}-${i + 1}`,
      count: 0,
    }));
    for (const total of totals) {
      const normalized = maxScore > 0 ? (total / maxScore) * 10 : 0;
      const idx = Math.min(9, Math.max(0, Math.floor(normalized)));
      distribution[idx].count += 1;
    }

    const passing = exam.passingScore !== null ? Number(exam.passingScore) : null;
    const passable = passing !== null;
    const passedCount = passable ? totals.filter((t) => t >= passing).length : 0;

    return {
      success: true,
      message: 'Exam report retrieved successfully',
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          durationMin: exam.durationMin,
          passingScore: passing,
          maxScore: Math.round(maxScore * 100) / 100,
          totalQuestions: questions.length,
        },
        questions,
        attempts: attemptRows,
        statistics,
        distribution,
        summary: {
          totalAttempts: attemptRows.length,
          avgScore:
            totals.length > 0
              ? Math.round((totals.reduce((s, v) => s + v, 0) / totals.length) * 100) / 100
              : null,
          minScore: totals.length > 0 ? Math.round(Math.min(...totals) * 100) / 100 : null,
          maxScoreAchieved: totals.length > 0 ? Math.round(Math.max(...totals) * 100) / 100 : null,
          medianScore: median(totals),
          passRate:
            passable && totals.length > 0
              ? Math.round((passedCount / totals.length) * 10000) / 100
              : null,
        },
      },
    };
  }

  // ═══════════════════════════════════════════════
  // MANUAL GRADE — override one answer's score, recompute the attempt total
  // ═══════════════════════════════════════════════
  async gradeAnswer(
    examId: number,
    attemptId: number,
    answerId: number,
    data: GradeAnswerInput,
    userId: number,
    role: string,
  ) {
    await this.assertExamOwner(examId, userId, role);

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, examId },
      select: {
        id: true,
        studentId: true,
        attemptAnswers: {
          select: { id: true, questionId: true, isCorrect: true, manualScore: true },
        },
        exam: { select: { examQuestions: { select: { questionId: true, points: true } } } },
      },
    });
    if (!attempt) throw new AppError('Attempt not found for this exam', 404);

    const target = attempt.attemptAnswers.find((a) => a.id === answerId);
    if (!target) throw new AppError('Answer not found for this attempt', 404);

    const pointsByQ = new Map<number, number>();
    attempt.exam.examQuestions.forEach((eq) => pointsByQ.set(eq.questionId, Number(eq.points)));
    const points = pointsByQ.get(target.questionId) ?? 0;

    if (data.score > points) {
      throw new AppError(`Score cannot exceed the question's maximum of ${points}`, 400);
    }

    const newScore = new Prisma.Decimal(data.score);
    const now = new Date();

    // Recompute the attempt total using the updated manual score.
    let total = new Prisma.Decimal(0);
    for (const a of attempt.attemptAnswers) {
      const pts = pointsByQ.get(a.questionId) ?? 0;
      if (a.id === answerId) {
        total = total.add(newScore);
      } else if (a.manualScore !== null && a.manualScore !== undefined) {
        total = total.add(a.manualScore);
      } else if (a.isCorrect) {
        total = total.add(new Prisma.Decimal(pts));
      }
    }

    await prisma.$transaction([
      prisma.attemptAnswer.update({
        where: { id: answerId },
        data: {
          manualScore: newScore,
          manualFeedback: data.feedback ?? null,
          isCorrect: data.score >= points && points > 0,
          gradedBy: userId,
          gradedAt: now,
        },
      }),
      prisma.examAttempt.update({
        where: { id: attemptId },
        data: { totalScore: total, status: 'GRADED' },
      }),
    ]);

    invalidateStudentCache(attempt.studentId).catch((err) =>
      logger.warn('Failed to invalidate analytics cache after manual grade:', err),
    );

    return {
      success: true,
      message: 'Answer graded successfully',
      data: { answerId, attemptId, score: data.score, totalScore: Number(total) },
    };
  }

  // ═══════════════════════════════════════════════
  // DELETE ATTEMPT (regrade/clean-up)
  // ═══════════════════════════════════════════════
  async deleteAttempt(examId: number, attemptId: number, userId: number, role: string) {
    await this.assertExamOwner(examId, userId, role);

    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, examId },
      select: { id: true, studentId: true },
    });
    if (!attempt) throw new AppError('Attempt not found for this exam', 404);

    await prisma.examAttempt.delete({ where: { id: attemptId } });

    invalidateStudentCache(attempt.studentId).catch((err) =>
      logger.warn('Failed to invalidate analytics cache after attempt deletion:', err),
    );

    return {
      success: true,
      message: 'Attempt deleted successfully',
      data: { attemptId },
    };
  }
}

export const examReportService = new ExamReportService();
