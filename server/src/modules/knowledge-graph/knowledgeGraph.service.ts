import { Prisma } from '@prisma/client';

import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { cacheGet, cacheSet, cacheInvalidate } from '../../utils/cache';
import { AppError } from '../../middlewares/errorHandler';
import {
  computeMastery,
  confidenceFromAttempts,
  daysSince,
  isStale,
  recommendationReason,
  weaknessLevelFromScore,
} from './knowledgeGraph.scoring';
import type {
  GraphEdge,
  GraphNode,
  GraphSummary,
  LearningPathResponse,
  LearningPathStep,
  NodeAlias,
  QualityReport,
  Recommendation,
  RelationDTO,
  RelationType,
  StudentGraphResponse,
} from './knowledgeGraph.types';
import type { KnowledgeRelationType } from '@prisma/client';

const CACHE_TTL = 300; // 5 minutes

// ─── cache keys ────────────────────────────────────
const studentGraphKey = (studentId: number, subjectId?: number) =>
  `kg:student:graph:${studentId}:${subjectId ?? 'all'}`;
const studentRecoKey = (studentId: number, subjectId?: number) =>
  `kg:student:reco:${studentId}:${subjectId ?? 'all'}`;
const classGraphKey = (classId: number, subjectId?: number | null) =>
  `kg:teacher:class:${classId}:${subjectId ?? 'all'}`;
const classWeakKey = (classId: number, subjectId?: number | null) =>
  `kg:teacher:weak:${classId}:${subjectId ?? 'all'}`;

/** Invalidate every cached graph/recommendation for one student. */
export async function invalidateStudentKnowledgeGraph(studentId: number): Promise<void> {
  await cacheInvalidate(`kg:student:*:${studentId}:*`);
}

/** Invalidate every teacher class-level graph (used after any student submits). */
export async function invalidateClassKnowledgeGraphs(): Promise<void> {
  await cacheInvalidate('kg:teacher:*');
}

/** Invalidate all knowledge-graph caches (used after autogenerate / node edits). */
export async function invalidateAllKnowledgeGraph(): Promise<void> {
  await cacheInvalidate('kg:*');
}

const normalizeTag = (raw: string): string => raw.trim().replace(/\s+/g, ' ').toLowerCase();
const skillKey = (chapterId: number, normTag: string): string => `${chapterId}::${normTag}`;

/** Strip HTML tags + collapse whitespace for a short question preview. */
const stripToText = (html: string): string => {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
};

class KnowledgeGraphService {
  // ═══════════════════════════════════════════════════
  // AUTOGENERATE — build the node tree + question links from
  // existing Subjects, Chapters, and QuestionTags (PDF §7 admin).
  // Idempotent: node ids stay stable across re-runs so mastery survives.
  // ═══════════════════════════════════════════════════
  async autogenerate(): Promise<{ subjects: number; chapters: number; skills: number; links: number }> {
    // 1. Subjects → SUBJECT nodes
    const subjects = await prisma.subject.findMany({ orderBy: { id: 'asc' } });
    const subjectNodeBySubjectId = new Map<number, number>();
    for (const s of subjects) {
      const node = await this.upsertNode(
        { type: 'SUBJECT', subjectId: s.id },
        {
          type: 'SUBJECT',
          subjectId: s.id,
          chapterId: null,
          parentId: null,
          name: s.name,
          orderIndex: s.id,
        },
        { name: s.name },
      );
      subjectNodeBySubjectId.set(s.id, node.id);
    }

    // 2. Chapters → CHAPTER nodes (parented to their subject node)
    const chapters = await prisma.chapter.findMany({
      orderBy: [{ subjectId: 'asc' }, { orderIndex: 'asc' }],
    });
    const chapterNodeByChapterId = new Map<number, number>();
    for (const c of chapters) {
      const parentId = subjectNodeBySubjectId.get(c.subjectId) ?? null;
      const node = await this.upsertNode(
        { type: 'CHAPTER', chapterId: c.id },
        {
          type: 'CHAPTER',
          subjectId: c.subjectId,
          chapterId: c.id,
          parentId,
          name: c.name,
          orderIndex: c.orderIndex,
        },
        { name: c.name, parentId, orderIndex: c.orderIndex },
      );
      chapterNodeByChapterId.set(c.id, node.id);
    }

    // 3. Question tags → SKILL nodes, keyed by (chapterId, normalized tag),
    //    parented to the chapter node. Free-text tags are de-duplicated.
    const tags = await prisma.questionTag.findMany({
      select: { tagName: true, question: { select: { subjectId: true, chapterId: true } } },
    });
    const skillMeta = new Map<string, { chapterId: number; subjectId: number; display: string }>();
    for (const t of tags) {
      const nt = normalizeTag(t.tagName);
      if (!nt) continue;
      const key = skillKey(t.question.chapterId, nt);
      if (!skillMeta.has(key)) {
        skillMeta.set(key, {
          chapterId: t.question.chapterId,
          subjectId: t.question.subjectId,
          display: t.tagName.trim(),
        });
      }
    }
    const skillNodeByKey = new Map<string, number>();
    for (const [key, meta] of skillMeta) {
      const parentId =
        chapterNodeByChapterId.get(meta.chapterId) ??
        subjectNodeBySubjectId.get(meta.subjectId) ??
        null;
      const node = await this.ensureSkillNode(meta, parentId);
      skillNodeByKey.set(key, node.id);
    }

    // 4. Question → node links. Every question links to its SUBJECT + CHAPTER
    //    node; tagged questions also link to matching SKILL nodes (PDF §8/§14
    //    "fall back to chapter when no skill tag").
    const questions = await prisma.question.findMany({
      select: {
        id: true,
        subjectId: true,
        chapterId: true,
        tags: { select: { tagName: true } },
      },
    });
    const linkRows: { questionId: number; knowledgeNodeId: number; weight: number }[] = [];
    const seen = new Set<string>();
    const pushLink = (questionId: number, knowledgeNodeId: number | undefined) => {
      if (!knowledgeNodeId) return;
      const k = `${questionId}:${knowledgeNodeId}`;
      if (seen.has(k)) return;
      seen.add(k);
      linkRows.push({ questionId, knowledgeNodeId, weight: 1 });
    };
    for (const q of questions) {
      pushLink(q.id, subjectNodeBySubjectId.get(q.subjectId));
      pushLink(q.id, chapterNodeByChapterId.get(q.chapterId));
      for (const t of q.tags) {
        const nt = normalizeTag(t.tagName);
        if (!nt) continue;
        pushLink(q.id, skillNodeByKey.get(skillKey(q.chapterId, nt)));
      }
    }

    // Replace all links in one transaction for idempotency.
    await prisma.$transaction([
      prisma.questionKnowledgeNode.deleteMany({}),
      ...(linkRows.length > 0
        ? [prisma.questionKnowledgeNode.createMany({ data: linkRows, skipDuplicates: true })]
        : []),
    ]);

    await invalidateAllKnowledgeGraph();
    logger.info(
      `[KnowledgeGraph] Autogenerate: ${subjects.length} subjects, ${chapters.length} chapters, ${skillMeta.size} skills, ${linkRows.length} links`,
    );
    return {
      subjects: subjects.length,
      chapters: chapters.length,
      skills: skillMeta.size,
      links: linkRows.length,
    };
  }

  private async upsertNode(
    match: Prisma.KnowledgeNodeWhereInput,
    create: Prisma.KnowledgeNodeUncheckedCreateInput,
    update: Prisma.KnowledgeNodeUncheckedUpdateInput,
  ) {
    const existing = await prisma.knowledgeNode.findFirst({ where: match, select: { id: true } });
    if (existing) {
      return prisma.knowledgeNode.update({ where: { id: existing.id }, data: update });
    }
    return prisma.knowledgeNode.create({ data: create });
  }

  private async ensureSkillNode(meta: { chapterId: number; subjectId: number; display: string }, parentId: number | null) {
    const existing = await prisma.knowledgeNode.findFirst({
      where: { type: 'SKILL', chapterId: meta.chapterId, name: { equals: meta.display, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      return prisma.knowledgeNode.update({
        where: { id: existing.id },
        data: { parentId, subjectId: meta.subjectId },
      });
    }
    return prisma.knowledgeNode.create({
      data: { type: 'SKILL', subjectId: meta.subjectId, chapterId: meta.chapterId, parentId, name: meta.display },
    });
  }

  /** Incremental sync of nodes + links for one question (convenience wrapper). */
  async syncQuestionNodes(questionId: number): Promise<void> {
    return this.syncQuestionsNodes([questionId]);
  }

  /**
   * Keep the knowledge tree + question links current for a set of questions —
   * called (fire-and-forget) whenever questions are created, edited, imported,
   * or (re)tagged, so admins never have to re-run Auto-generate manually.
   * Idempotent: ensures the SUBJECT/CHAPTER/SKILL nodes exist, then rebuilds
   * only these questions' links.
   */
  async syncQuestionsNodes(questionIds: number[]): Promise<void> {
    const ids = [...new Set(questionIds)].filter((n) => Number.isInteger(n));
    if (ids.length === 0) return;

    const questions = await prisma.question.findMany({
      where: { id: { in: ids } },
      select: { id: true, subjectId: true, chapterId: true, tags: { select: { tagName: true } } },
    });
    if (questions.length === 0) return;

    // Ensure SUBJECT nodes.
    const subjectIds = [...new Set(questions.map((q) => q.subjectId))];
    const subjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true },
    });
    const subjectNodeBySubjectId = new Map<number, number>();
    for (const s of subjects) {
      const node = await this.upsertNode(
        { type: 'SUBJECT', subjectId: s.id },
        { type: 'SUBJECT', subjectId: s.id, chapterId: null, parentId: null, name: s.name, orderIndex: s.id },
        { name: s.name },
      );
      subjectNodeBySubjectId.set(s.id, node.id);
    }

    // Ensure CHAPTER nodes.
    const chapterIds = [...new Set(questions.map((q) => q.chapterId))];
    const chapters = await prisma.chapter.findMany({
      where: { id: { in: chapterIds } },
      select: { id: true, subjectId: true, name: true, orderIndex: true },
    });
    const chapterNodeByChapterId = new Map<number, number>();
    for (const c of chapters) {
      const parentId = subjectNodeBySubjectId.get(c.subjectId) ?? null;
      const node = await this.upsertNode(
        { type: 'CHAPTER', chapterId: c.id },
        { type: 'CHAPTER', subjectId: c.subjectId, chapterId: c.id, parentId, name: c.name, orderIndex: c.orderIndex },
        { name: c.name, parentId, orderIndex: c.orderIndex },
      );
      chapterNodeByChapterId.set(c.id, node.id);
    }

    // Ensure SKILL nodes for each distinct (chapter, tag).
    const skillMeta = new Map<string, { chapterId: number; subjectId: number; display: string }>();
    for (const q of questions) {
      for (const t of q.tags) {
        const nt = normalizeTag(t.tagName);
        if (!nt) continue;
        const key = skillKey(q.chapterId, nt);
        if (!skillMeta.has(key)) {
          skillMeta.set(key, { chapterId: q.chapterId, subjectId: q.subjectId, display: t.tagName.trim() });
        }
      }
    }
    const skillNodeByKey = new Map<string, number>();
    for (const [key, meta] of skillMeta) {
      const parentId =
        chapterNodeByChapterId.get(meta.chapterId) ?? subjectNodeBySubjectId.get(meta.subjectId) ?? null;
      const node = await this.ensureSkillNode(meta, parentId);
      skillNodeByKey.set(key, node.id);
    }

    // Rebuild links for just these questions.
    const linkRows: { questionId: number; knowledgeNodeId: number; weight: number }[] = [];
    const seen = new Set<string>();
    const pushLink = (questionId: number, knowledgeNodeId: number | undefined) => {
      if (!knowledgeNodeId) return;
      const k = `${questionId}:${knowledgeNodeId}`;
      if (seen.has(k)) return;
      seen.add(k);
      linkRows.push({ questionId, knowledgeNodeId, weight: 1 });
    };
    for (const q of questions) {
      pushLink(q.id, subjectNodeBySubjectId.get(q.subjectId));
      pushLink(q.id, chapterNodeByChapterId.get(q.chapterId));
      for (const t of q.tags) {
        const nt = normalizeTag(t.tagName);
        if (!nt) continue;
        pushLink(q.id, skillNodeByKey.get(skillKey(q.chapterId, nt)));
      }
    }

    await prisma.$transaction([
      prisma.questionKnowledgeNode.deleteMany({ where: { questionId: { in: ids } } }),
      ...(linkRows.length > 0
        ? [prisma.questionKnowledgeNode.createMany({ data: linkRows, skipDuplicates: true })]
        : []),
    ]);

    await invalidateAllKnowledgeGraph();
  }

  // ═══════════════════════════════════════════════════
  // MASTERY RECALCULATION (PDF §8 data pipeline)
  // ═══════════════════════════════════════════════════

  /** Recompute mastery for the nodes touched by one submitted attempt. */
  async recalculateAttemptMastery(attemptId: number): Promise<void> {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: { studentId: true, status: true },
    });
    if (!attempt || attempt.status !== 'SUBMITTED') return;

    const answers = await prisma.attemptAnswer.findMany({
      where: { attemptId },
      select: { questionId: true },
    });
    const questionIds = [...new Set(answers.map((a) => a.questionId))];
    if (questionIds.length === 0) return;

    const links = await prisma.questionKnowledgeNode.findMany({
      where: { questionId: { in: questionIds } },
      select: { knowledgeNodeId: true },
    });
    const nodeIds = [...new Set(links.map((l) => l.knowledgeNodeId))];
    await this.recomputeNodesForStudent(attempt.studentId, nodeIds);
  }

  /** Full recompute for one student (admin backfill / repair). */
  async recalculateStudentMastery(studentId: number): Promise<void> {
    const answers = await prisma.attemptAnswer.findMany({
      where: { attempt: { studentId, status: 'SUBMITTED' } },
      select: { questionId: true },
    });
    const questionIds = [...new Set(answers.map((a) => a.questionId))];
    if (questionIds.length === 0) return;

    const links = await prisma.questionKnowledgeNode.findMany({
      where: { questionId: { in: questionIds } },
      select: { knowledgeNodeId: true },
    });
    const nodeIds = [...new Set(links.map((l) => l.knowledgeNodeId))];
    await this.recomputeNodesForStudent(studentId, nodeIds);
  }

  /** Backfill mastery for every student with submitted attempts. */
  async recalculateAll(): Promise<{ students: number }> {
    const students = await prisma.examAttempt.findMany({
      where: { status: 'SUBMITTED' },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    for (const s of students) {
      await this.recalculateStudentMastery(s.studentId);
    }
    await invalidateAllKnowledgeGraph();
    return { students: students.length };
  }

  private async recomputeNodesForStudent(studentId: number, nodeIds: number[]): Promise<void> {
    if (nodeIds.length === 0) return;

    const rows = await prisma.$queryRaw<
      Array<{
        nodeId: number;
        attemptCount: number;
        correctCount: number;
        weightedCorrect: number;
        weightSum: number;
        avgTimeSec: number | null;
        lastAttemptAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT qkn."knowledge_node_id" AS "nodeId",
             COUNT(*)::int AS "attemptCount",
             SUM(CASE WHEN aa."is_correct" THEN 1 ELSE 0 END)::int AS "correctCount",
             SUM(CASE WHEN aa."is_correct" THEN q."difficulty" * qkn."weight" ELSE 0 END)::float AS "weightedCorrect",
             SUM(q."difficulty" * qkn."weight")::float AS "weightSum",
             AVG(aa."time_spent_sec")::float AS "avgTimeSec",
             MAX(ea."submitted_at") AS "lastAttemptAt"
      FROM "attempt_answers" aa
      JOIN "exam_attempts" ea ON ea."id" = aa."attempt_id"
      JOIN "question_knowledge_nodes" qkn ON qkn."question_id" = aa."question_id"
      JOIN "questions" q ON q."id" = aa."question_id"
      WHERE ea."student_id" = ${studentId}
        AND ea."status" = 'SUBMITTED'
        AND qkn."knowledge_node_id" IN (${Prisma.join(nodeIds)})
      GROUP BY qkn."knowledge_node_id"
    `);
    if (rows.length === 0) return;

    const nodeMeta = await prisma.knowledgeNode.findMany({
      where: { id: { in: rows.map((r) => r.nodeId) } },
      select: { id: true, subjectId: true },
    });
    const subjectByNode = new Map(nodeMeta.map((n) => [n.id, n.subjectId]));

    for (const r of rows) {
      const m = computeMastery({
        correctCount: r.correctCount,
        attemptCount: r.attemptCount,
        weightedCorrect: r.weightedCorrect ?? 0,
        weightSum: r.weightSum ?? 0,
      });
      const data = {
        subjectId: subjectByNode.get(r.nodeId) ?? null,
        masteryScore: m.masteryScore,
        accuracyRate: m.accuracyRate,
        attemptCount: r.attemptCount,
        correctCount: r.correctCount,
        avgTimeSec: r.avgTimeSec,
        weaknessLevel: m.weaknessLevel,
        lastAttemptAt: r.lastAttemptAt,
      };
      await prisma.studentKnowledgeMastery.upsert({
        where: { studentId_knowledgeNodeId: { studentId, knowledgeNodeId: r.nodeId } },
        create: { studentId, knowledgeNodeId: r.nodeId, ...data },
        update: data,
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // STUDENT GRAPH (PDF §9.1)
  // ═══════════════════════════════════════════════════

  async getStudentGraph(studentId: number, subjectId?: number): Promise<StudentGraphResponse> {
    const key = studentGraphKey(studentId, subjectId);
    const cached = await cacheGet<StudentGraphResponse>(key);
    if (cached) return cached;

    const [student, nodes, mastery] = await Promise.all([
      prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, fullName: true, username: true },
      }),
      prisma.knowledgeNode.findMany({
        where: subjectId ? { subjectId } : {},
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
      }),
      prisma.studentKnowledgeMastery.findMany({
        where: { studentId, ...(subjectId ? { knowledgeNode: { subjectId } } : {}) },
      }),
    ]);

    const masteryByNode = new Map(mastery.map((m) => [m.knowledgeNodeId, m]));

    const graphNodes: GraphNode[] = nodes.map((n) => {
      const m = masteryByNode.get(n.id);
      const attemptCount = m?.attemptCount ?? 0;
      const masteryScore = m?.masteryScore ?? 0;
      const lastAttemptAt = m?.lastAttemptAt ?? null;
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        subjectId: n.subjectId,
        chapterId: n.chapterId,
        parentId: n.parentId,
        orderIndex: n.orderIndex,
        masteryScore,
        accuracyRate: m?.accuracyRate ?? 0,
        weaknessLevel: weaknessLevelFromScore(masteryScore, attemptCount),
        confidence: confidenceFromAttempts(attemptCount),
        attemptCount,
        correctCount: m?.correctCount ?? 0,
        avgTimeSec: m?.avgTimeSec ?? null,
        lastAttemptAt: lastAttemptAt ? lastAttemptAt.toISOString() : null,
        daysSinceLastPractice: daysSince(lastAttemptAt),
        stale: attemptCount > 0 && isStale(lastAttemptAt),
      };
    });
    const nodeById = new Map(graphNodes.map((n) => [n.id, n]));

    const edges: GraphEdge[] = graphNodes
      .filter((n) => n.parentId != null && nodeById.has(n.parentId))
      .map((n) => ({ from: n.parentId as number, to: n.id, type: 'parent-child' as const }));

    // Overall mastery is computed over CHAPTER nodes (each answered question maps
    // to exactly one chapter, so this avoids double-counting).
    const chapterNodes = graphNodes.filter((n) => n.type === 'CHAPTER' && n.attemptCount > 0);
    const totalCorrect = chapterNodes.reduce((a, n) => a + n.correctCount, 0);
    const totalAttempt = chapterNodes.reduce((a, n) => a + n.attemptCount, 0);
    const overallMastery = totalAttempt > 0 ? Math.round((totalCorrect / totalAttempt) * 1000) / 10 : 0;

    const learningNodes = graphNodes.filter(
      (n) => (n.type === 'CHAPTER' || n.type === 'SKILL') && n.attemptCount > 0,
    );
    const countLevel = (lvl: string) => learningNodes.filter((n) => n.weaknessLevel === lvl).length;
    const summary: GraphSummary = {
      overallMastery,
      totalNodes: graphNodes.length,
      attemptedNodes: learningNodes.length,
      strongCount: countLevel('strong'),
      goodCount: countLevel('good'),
      mediumCount: countLevel('medium'),
      weakCount: countLevel('weak'),
      criticalCount: countLevel('critical'),
    };

    // Prerequisite edges among the visible nodes power prerequisite-aware
    // recommendations (PDF §8 "Repair prerequisite").
    const nodeIdList = graphNodes.map((n) => n.id);
    const prereqRels =
      nodeIdList.length > 0
        ? await prisma.knowledgeRelation.findMany({
            where: { relationType: 'PREREQUISITE_OF', toNodeId: { in: nodeIdList } },
            select: { fromNodeId: true, toNodeId: true },
          })
        : [];
    const prereqMap = new Map<number, number[]>();
    for (const r of prereqRels) {
      const arr = prereqMap.get(r.toNodeId) ?? [];
      arr.push(r.fromNodeId);
      prereqMap.set(r.toNodeId, arr);
    }

    const recommendations = this.buildRecommendations(graphNodes, prereqMap);

    const result: StudentGraphResponse = {
      student: {
        id: studentId,
        fullName: student?.fullName ?? student?.username ?? 'Student',
      },
      summary,
      nodes: graphNodes,
      edges,
      recommendations,
    };
    await cacheSet(key, result, CACHE_TTL);
    return result;
  }

  async getStudentRecommendations(studentId: number, subjectId?: number): Promise<Recommendation[]> {
    const key = studentRecoKey(studentId, subjectId);
    const cached = await cacheGet<Recommendation[]>(key);
    if (cached) return cached;

    const graph = await this.getStudentGraph(studentId, subjectId);
    const recs = graph.recommendations;
    await cacheSet(key, recs, CACHE_TTL);
    return recs;
  }

  /**
   * Turn the measured graph into prioritised "next best actions" with stable
   * reason codes (PDF §8 Recommendation engine + Appendix reason codes):
   * PREREQ_GAP → LOW_MASTERY → LOW_CONFIDENCE → STALE_MASTERY.
   */
  private buildRecommendations(
    nodes: GraphNode[],
    prereqMap: Map<number, number[]>,
  ): Recommendation[] {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const recs: Recommendation[] = [];

    for (const n of nodes) {
      if (n.attemptCount <= 0 || n.type === 'SUBJECT') continue;
      const base = {
        nodeId: n.id,
        name: n.name,
        type: n.type,
        subjectId: n.subjectId,
        masteryScore: n.masteryScore,
        confidence: n.confidence,
        evidenceCount: n.attemptCount,
      };

      // 1. Prerequisite gap — a measured prerequisite is weaker than this weak node.
      const weakPrereq = (prereqMap.get(n.id) ?? [])
        .map((id) => byId.get(id))
        .filter(
          (p): p is GraphNode =>
            !!p && p.attemptCount > 0 && p.masteryScore < n.masteryScore && p.masteryScore < 60,
        )
        .sort((a, b) => a.masteryScore - b.masteryScore)[0];
      if ((n.weaknessLevel === 'weak' || n.weaknessLevel === 'critical') && weakPrereq) {
        recs.push({
          ...base,
          reasonCode: 'PREREQ_GAP',
          priority: 'high',
          reason: `Study prerequisite "${weakPrereq.name}" (${Math.round(weakPrereq.masteryScore)}%) first, then retry`,
          prerequisite: {
            nodeId: weakPrereq.id,
            name: weakPrereq.name,
            masteryScore: weakPrereq.masteryScore,
          },
        });
        continue;
      }

      // 2. Low mastery.
      if (n.weaknessLevel === 'critical' || n.weaknessLevel === 'weak') {
        recs.push({
          ...base,
          reasonCode: 'LOW_MASTERY',
          priority: n.weaknessLevel === 'critical' ? 'high' : 'medium',
          reason: recommendationReason(n.masteryScore, n.attemptCount),
          prerequisite: null,
        });
        continue;
      }

      // 3. Decent score but too little evidence to trust it.
      if (n.confidence === 'low' && n.masteryScore >= 60) {
        recs.push({
          ...base,
          reasonCode: 'LOW_CONFIDENCE',
          priority: 'medium',
          reason: `Only ${n.attemptCount} question(s) answered — confirm with a short practice`,
          prerequisite: null,
        });
        continue;
      }

      // 4. Previously solid but gone stale (spaced review).
      if (n.stale && n.weaknessLevel !== 'unknown') {
        recs.push({
          ...base,
          reasonCode: 'STALE_MASTERY',
          priority: 'medium',
          reason: `Not practised for ${n.daysSinceLastPractice ?? 0}+ days — review to keep it fresh`,
          prerequisite: null,
        });
        continue;
      }
    }

    const prio = { high: 0, medium: 1 } as const;
    return recs
      .sort((a, b) => prio[a.priority] - prio[b.priority] || a.masteryScore - b.masteryScore)
      .slice(0, 8);
  }

  /** Teacher view of one student's graph — only if they share a class. */
  async getStudentGraphForTeacher(
    studentId: number,
    teacherId: number,
    subjectId?: number,
  ): Promise<StudentGraphResponse | null> {
    const link = await prisma.classStudent.findFirst({
      where: { studentId, class: { teacherId } },
      select: { classId: true },
    });
    if (!link) return null;
    return this.getStudentGraph(studentId, subjectId);
  }

  // ═══════════════════════════════════════════════════
  // TEACHER CLASS GRAPH + WEAK NODES (PDF §10.2)
  // ═══════════════════════════════════════════════════

  async getClassGraph(classId: number, teacherId: number, subjectId?: number) {
    const cls = await prisma.class.findFirst({
      where: { id: classId, teacherId },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        subjectId: true,
        subject: { select: { name: true } },
      },
    });
    if (!cls) return null;

    const effectiveSubject = subjectId ?? cls.subjectId;
    const key = classGraphKey(classId, effectiveSubject);
    const cached = await cacheGet(key);
    if (cached) return cached;

    const enroll = await prisma.classStudent.findMany({
      where: { classId },
      select: { student: { select: { id: true, fullName: true, username: true } } },
      orderBy: { studentId: 'asc' },
    });
    const students = enroll.map((e) => ({
      id: e.student.id,
      fullName: e.student.fullName ?? e.student.username,
    }));
    const studentIds = students.map((s) => s.id);

    // Heatmap columns: CHAPTER nodes in the subject (kept readable).
    const columns = await prisma.knowledgeNode.findMany({
      where: { type: 'CHAPTER', subjectId: effectiveSubject },
      orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, type: true },
    });
    const columnIds = columns.map((c) => c.id);

    let cells: Array<{
      studentId: number;
      nodeId: number;
      masteryScore: number;
      weaknessLevel: string;
      attemptCount: number;
    }> = [];
    if (studentIds.length > 0 && columnIds.length > 0) {
      const mastery = await prisma.studentKnowledgeMastery.findMany({
        where: { studentId: { in: studentIds }, knowledgeNodeId: { in: columnIds } },
        select: {
          studentId: true,
          knowledgeNodeId: true,
          masteryScore: true,
          weaknessLevel: true,
          attemptCount: true,
        },
      });
      cells = mastery.map((m) => ({
        studentId: m.studentId,
        nodeId: m.knowledgeNodeId,
        masteryScore: m.masteryScore,
        weaknessLevel: m.weaknessLevel,
        attemptCount: m.attemptCount,
      }));
    }

    const result = {
      class: {
        id: cls.id,
        name: cls.name,
        gradeLevel: cls.gradeLevel,
        subjectId: cls.subjectId,
        subjectName: cls.subject.name,
      },
      subjectId: effectiveSubject,
      students,
      nodes: columns,
      cells,
    };
    await cacheSet(key, result, CACHE_TTL);
    return result;
  }

  async getClassWeakNodes(classId: number, teacherId: number, subjectId?: number) {
    const cls = await prisma.class.findFirst({
      where: { id: classId, teacherId },
      select: { id: true, subjectId: true },
    });
    if (!cls) return null;

    const effectiveSubject = subjectId ?? cls.subjectId;
    const key = classWeakKey(classId, effectiveSubject);
    const cached = await cacheGet(key);
    if (cached) return cached;

    const studentIds = (
      await prisma.classStudent.findMany({ where: { classId }, select: { studentId: true } })
    ).map((s) => s.studentId);

    let rows: Array<{
      nodeId: number;
      name: string;
      type: string;
      avgMastery: number;
      studentsWithData: number;
      weakStudents: number;
    }> = [];
    if (studentIds.length > 0) {
      rows = await prisma.$queryRaw(Prisma.sql`
        SELECT kn."id" AS "nodeId",
               kn."name" AS "name",
               kn."type"::text AS "type",
               AVG(skm."mastery_score")::float AS "avgMastery",
               COUNT(*)::int AS "studentsWithData",
               SUM(CASE WHEN skm."mastery_score" < 60 THEN 1 ELSE 0 END)::int AS "weakStudents"
        FROM "student_knowledge_mastery" skm
        JOIN "knowledge_nodes" kn ON kn."id" = skm."knowledge_node_id"
        WHERE skm."student_id" IN (${Prisma.join(studentIds)})
          AND kn."subject_id" = ${effectiveSubject}
          AND kn."type" IN ('CHAPTER', 'SKILL')
          AND skm."attempt_count" > 0
        GROUP BY kn."id", kn."name", kn."type"
        ORDER BY "avgMastery" ASC
        LIMIT 20
      `);
    }
    await cacheSet(key, rows, CACHE_TTL);
    return rows;
  }

  // ═══════════════════════════════════════════════════
  // ADMIN NODE MANAGEMENT (PDF §7 admin endpoints)
  // ═══════════════════════════════════════════════════

  async listNodes(subjectId?: number) {
    const nodes = await prisma.knowledgeNode.findMany({
      where: subjectId ? { subjectId } : {},
      orderBy: [{ type: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { questionLinks: true, children: true, aliases: true } } },
    });
    return nodes.map((n) => ({
      id: n.id,
      name: n.name,
      description: n.description,
      type: n.type,
      subjectId: n.subjectId,
      chapterId: n.chapterId,
      parentId: n.parentId,
      orderIndex: n.orderIndex,
      questionCount: n._count.questionLinks,
      childCount: n._count.children,
      aliasCount: n._count.aliases,
    }));
  }

  async updateNode(
    id: number,
    data: { name?: string; description?: string | null; orderIndex?: number },
  ) {
    const exists = await prisma.knowledgeNode.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError('Knowledge node not found', 404);
    const updated = await prisma.knowledgeNode.update({ where: { id }, data });
    await invalidateAllKnowledgeGraph();
    return updated;
  }

  async deleteNode(id: number) {
    const exists = await prisma.knowledgeNode.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError('Knowledge node not found', 404);
    await prisma.knowledgeNode.delete({ where: { id } });
    await invalidateAllKnowledgeGraph();
    return { id };
  }

  // ═══════════════════════════════════════════════════
  // KNOWLEDGE RELATIONS (PDF §5 graph edges, §15 admin API)
  // ═══════════════════════════════════════════════════

  async listRelations(
    params: { nodeId?: number; relationType?: RelationType } = {},
  ): Promise<RelationDTO[]> {
    const where: Prisma.KnowledgeRelationWhereInput = {};
    if (params.relationType) where.relationType = params.relationType as KnowledgeRelationType;
    if (params.nodeId) where.OR = [{ fromNodeId: params.nodeId }, { toNodeId: params.nodeId }];
    const rels = await prisma.knowledgeRelation.findMany({
      where,
      orderBy: { id: 'desc' },
      include: { fromNode: { select: { name: true } }, toNode: { select: { name: true } } },
    });
    return rels.map((r) => this.toRelationDTO(r));
  }

  private toRelationDTO(r: {
    id: number;
    fromNodeId: number;
    toNodeId: number;
    relationType: KnowledgeRelationType;
    weight: number;
    source: string;
    note: string | null;
    fromNode: { name: string };
    toNode: { name: string };
  }): RelationDTO {
    return {
      id: r.id,
      fromNodeId: r.fromNodeId,
      toNodeId: r.toNodeId,
      fromName: r.fromNode.name,
      toName: r.toNode.name,
      relationType: r.relationType as RelationType,
      weight: r.weight,
      source: r.source,
      note: r.note,
    };
  }

  async createRelation(
    data: {
      fromNodeId: number;
      toNodeId: number;
      relationType: RelationType;
      weight?: number;
      note?: string | null;
    },
    createdBy?: number,
  ): Promise<RelationDTO> {
    if (data.fromNodeId === data.toNodeId) {
      throw new AppError('A node cannot relate to itself', 400);
    }
    const nodes = await prisma.knowledgeNode.findMany({
      where: { id: { in: [data.fromNodeId, data.toNodeId] } },
      select: { id: true },
    });
    if (nodes.length < 2) throw new AppError('One or both nodes were not found', 404);

    const existing = await prisma.knowledgeRelation.findFirst({
      where: {
        fromNodeId: data.fromNodeId,
        toNodeId: data.toNodeId,
        relationType: data.relationType as KnowledgeRelationType,
      },
      select: { id: true },
    });
    if (existing) throw new AppError('This relation already exists', 409);

    const created = await prisma.knowledgeRelation.create({
      data: {
        fromNodeId: data.fromNodeId,
        toNodeId: data.toNodeId,
        relationType: data.relationType as KnowledgeRelationType,
        weight: data.weight ?? 1,
        note: data.note ?? null,
        source: 'manual',
        createdBy: createdBy ?? null,
      },
      include: { fromNode: { select: { name: true } }, toNode: { select: { name: true } } },
    });
    await invalidateAllKnowledgeGraph();
    return this.toRelationDTO(created);
  }

  async deleteRelation(id: number): Promise<{ id: number }> {
    const exists = await prisma.knowledgeRelation.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError('Relation not found', 404);
    await prisma.knowledgeRelation.delete({ where: { id } });
    await invalidateAllKnowledgeGraph();
    return { id };
  }

  /** Seed PART_OF edges from the existing parent/child tree (idempotent). */
  async seedPartOfRelations(): Promise<{ created: number }> {
    const nodes = await prisma.knowledgeNode.findMany({
      where: { parentId: { not: null } },
      select: { id: true, parentId: true },
    });
    if (nodes.length === 0) return { created: 0 };
    const rows = nodes.map((n) => ({
      fromNodeId: n.id,
      toNodeId: n.parentId as number,
      relationType: 'PART_OF' as KnowledgeRelationType,
      source: 'auto',
    }));
    const res = await prisma.knowledgeRelation.createMany({ data: rows, skipDuplicates: true });
    await invalidateAllKnowledgeGraph();
    return { created: res.count };
  }

  // ═══════════════════════════════════════════════════
  // GOVERNANCE: ALIASES + MERGE + QUALITY (PDF §6/§11/§16)
  // ═══════════════════════════════════════════════════

  async listNodeAliases(nodeId: number): Promise<NodeAlias[]> {
    const rows = await prisma.knowledgeNodeAlias.findMany({
      where: { knowledgeNodeId: nodeId },
      orderBy: { id: 'asc' },
      select: { id: true, alias: true, source: true },
    });
    return rows;
  }

  async addNodeAlias(nodeId: number, alias: string): Promise<NodeAlias> {
    const node = await prisma.knowledgeNode.findUnique({ where: { id: nodeId }, select: { id: true } });
    if (!node) throw new AppError('Knowledge node not found', 404);
    const trimmed = alias.trim();
    if (!trimmed) throw new AppError('Alias cannot be empty', 400);
    const normalizedAlias = normalizeTag(trimmed);
    const existing = await prisma.knowledgeNodeAlias.findFirst({
      where: { knowledgeNodeId: nodeId, normalizedAlias },
      select: { id: true },
    });
    if (existing) throw new AppError('This alias already exists for the node', 409);
    const created = await prisma.knowledgeNodeAlias.create({
      data: { knowledgeNodeId: nodeId, alias: trimmed, normalizedAlias, source: 'manual' },
      select: { id: true, alias: true, source: true },
    });
    await invalidateAllKnowledgeGraph();
    return created;
  }

  async deleteNodeAlias(aliasId: number): Promise<{ id: number }> {
    const exists = await prisma.knowledgeNodeAlias.findUnique({
      where: { id: aliasId },
      select: { id: true },
    });
    if (!exists) throw new AppError('Alias not found', 404);
    await prisma.knowledgeNodeAlias.delete({ where: { id: aliasId } });
    await invalidateAllKnowledgeGraph();
    return { id: aliasId };
  }

  /**
   * Merge `sourceId` into `targetId`: repoint question links, aliases, and
   * relations, record the source name as an alias, drop the source node, and
   * clear the source's stale mastery rows (PDF §6/§15 "merge duplicate skills").
   * Admins should run "Recalculate mastery" afterwards to refresh the target.
   */
  async mergeNodes(sourceId: number, targetId: number): Promise<{ merged: number; into: number }> {
    if (sourceId === targetId) throw new AppError('Cannot merge a node into itself', 400);
    const [source, target] = await Promise.all([
      prisma.knowledgeNode.findUnique({ where: { id: sourceId }, select: { id: true, name: true } }),
      prisma.knowledgeNode.findUnique({ where: { id: targetId }, select: { id: true, name: true } }),
    ]);
    if (!source) throw new AppError('Source node not found', 404);
    if (!target) throw new AppError('Target node not found', 404);

    await prisma.$transaction(async (tx) => {
      // 1. Question links — move those not already on the target, drop the rest.
      const [srcLinks, tgtLinks] = await Promise.all([
        tx.questionKnowledgeNode.findMany({
          where: { knowledgeNodeId: sourceId },
          select: { questionId: true, weight: true, confidence: true, evidenceSource: true, reviewStatus: true },
        }),
        tx.questionKnowledgeNode.findMany({
          where: { knowledgeNodeId: targetId },
          select: { questionId: true },
        }),
      ]);
      const targetQ = new Set(tgtLinks.map((l) => l.questionId));
      const toCreate = srcLinks
        .filter((l) => !targetQ.has(l.questionId))
        .map((l) => ({
          questionId: l.questionId,
          knowledgeNodeId: targetId,
          weight: l.weight,
          confidence: l.confidence,
          evidenceSource: l.evidenceSource,
          reviewStatus: l.reviewStatus,
        }));
      await tx.questionKnowledgeNode.deleteMany({ where: { knowledgeNodeId: sourceId } });
      if (toCreate.length > 0) {
        await tx.questionKnowledgeNode.createMany({ data: toCreate, skipDuplicates: true });
      }

      // 2. Aliases — move, then add the source name as an alias of the target.
      const srcAliases = await tx.knowledgeNodeAlias.findMany({
        where: { knowledgeNodeId: sourceId },
        select: { alias: true, normalizedAlias: true, source: true },
      });
      const tgtAliasNorms = new Set(
        (
          await tx.knowledgeNodeAlias.findMany({
            where: { knowledgeNodeId: targetId },
            select: { normalizedAlias: true },
          })
        ).map((a) => a.normalizedAlias),
      );
      const sourceNameNorm = normalizeTag(source.name);
      const aliasRows = [
        ...srcAliases,
        { alias: source.name, normalizedAlias: sourceNameNorm, source: 'merge' },
      ].filter((a) => a.normalizedAlias && !tgtAliasNorms.has(a.normalizedAlias));
      await tx.knowledgeNodeAlias.deleteMany({ where: { knowledgeNodeId: sourceId } });
      // De-dupe within the batch itself.
      const seenNorm = new Set<string>();
      const aliasCreate = aliasRows
        .filter((a) => {
          if (seenNorm.has(a.normalizedAlias)) return false;
          seenNorm.add(a.normalizedAlias);
          return true;
        })
        .map((a) => ({
          knowledgeNodeId: targetId,
          alias: a.alias,
          normalizedAlias: a.normalizedAlias,
          source: a.source,
        }));
      if (aliasCreate.length > 0) {
        await tx.knowledgeNodeAlias.createMany({ data: aliasCreate, skipDuplicates: true });
      }

      // 3. Relations — repoint endpoints, skipping self-loops and duplicates.
      const rels = await tx.knowledgeRelation.findMany({
        where: { OR: [{ fromNodeId: sourceId }, { toNodeId: sourceId }] },
      });
      for (const r of rels) {
        const newFrom = r.fromNodeId === sourceId ? targetId : r.fromNodeId;
        const newTo = r.toNodeId === sourceId ? targetId : r.toNodeId;
        if (newFrom === newTo) {
          await tx.knowledgeRelation.delete({ where: { id: r.id } });
          continue;
        }
        const clash = await tx.knowledgeRelation.findFirst({
          where: {
            fromNodeId: newFrom,
            toNodeId: newTo,
            relationType: r.relationType,
            id: { not: r.id },
          },
          select: { id: true },
        });
        if (clash) {
          await tx.knowledgeRelation.delete({ where: { id: r.id } });
        } else {
          await tx.knowledgeRelation.update({
            where: { id: r.id },
            data: { fromNodeId: newFrom, toNodeId: newTo },
          });
        }
      }

      // 4. Mastery — source rows are stale once links move; drop them. (Target
      //    refreshes on the next submit or via admin "Recalculate mastery".)
      await tx.studentKnowledgeMastery.deleteMany({ where: { knowledgeNodeId: sourceId } });

      // 5. Re-parent any children of the source onto the target, then delete source.
      await tx.knowledgeNode.updateMany({
        where: { parentId: sourceId },
        data: { parentId: targetId },
      });
      await tx.knowledgeNode.delete({ where: { id: sourceId } });
    });

    await invalidateAllKnowledgeGraph();
    return { merged: sourceId, into: targetId };
  }

  /** Taxonomy quality report for the admin dashboard (PDF §11/§16). */
  async getQualityReport(): Promise<QualityReport> {
    const LOW_CONF = 0.5;
    const [
      nodes,
      relations,
      questions,
      mappedRows,
      unmappedCount,
      unmappedSample,
      orphanCount,
      orphanSample,
      lowConfidenceMappings,
      dupRows,
      overMappedRows,
      thinRows,
    ] = await Promise.all([
      prisma.knowledgeNode.count(),
      prisma.knowledgeRelation.count(),
      prisma.question.count(),
      prisma.$queryRaw<Array<{ c: number }>>(
        Prisma.sql`SELECT COUNT(DISTINCT "question_id")::int AS c FROM "question_knowledge_nodes"`,
      ),
      prisma.question.count({ where: { knowledgeLinks: { none: {} } } }),
      prisma.question.findMany({
        where: { knowledgeLinks: { none: {} } },
        take: 10,
        orderBy: { id: 'desc' },
        select: { id: true, content: true },
      }),
      prisma.knowledgeNode.count({
        where: { type: { in: ['SKILL', 'SUBSKILL'] }, questionLinks: { none: {} }, children: { none: {} } },
      }),
      prisma.knowledgeNode.findMany({
        where: { type: { in: ['SKILL', 'SUBSKILL'] }, questionLinks: { none: {} }, children: { none: {} } },
        take: 10,
        orderBy: { id: 'asc' },
        select: { id: true, name: true, type: true },
      }),
      prisma.questionKnowledgeNode.count({
        where: { OR: [{ confidence: { lt: LOW_CONF } }, { reviewStatus: 'pending' }] },
      }),
      prisma.$queryRaw<Array<{ name: string; ids: number[] }>>(Prisma.sql`
        SELECT lower(trim("name")) AS name, array_agg("id" ORDER BY "id") AS ids
        FROM "knowledge_nodes"
        GROUP BY lower(trim("name")), "chapter_id", "type"
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 15
      `),
      prisma.$queryRaw<Array<{ questionId: number; skillCount: number }>>(Prisma.sql`
        SELECT qkn."question_id" AS "questionId", COUNT(*)::int AS "skillCount"
        FROM "question_knowledge_nodes" qkn
        JOIN "knowledge_nodes" kn ON kn."id" = qkn."knowledge_node_id"
        WHERE kn."type" = 'SKILL'
        GROUP BY qkn."question_id"
        HAVING COUNT(*) > 3
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `),
      prisma.$queryRaw<Array<{ id: number; name: string; questionCount: number }>>(Prisma.sql`
        SELECT kn."id" AS "id", kn."name" AS "name", COUNT(qkn."question_id")::int AS "questionCount"
        FROM "knowledge_nodes" kn
        LEFT JOIN "question_knowledge_nodes" qkn ON qkn."knowledge_node_id" = kn."id"
        WHERE kn."type" = 'SKILL'
        GROUP BY kn."id", kn."name"
        HAVING COUNT(qkn."question_id") > 0 AND COUNT(qkn."question_id") < 5
        ORDER BY COUNT(qkn."question_id") ASC
        LIMIT 10
      `),
    ]);

    const mappedQuestions = mappedRows[0]?.c ?? 0;
    const coverage = questions > 0 ? Math.round((mappedQuestions / questions) * 1000) / 10 : 0;

    return {
      totals: { nodes, relations, questions, mappedQuestions, coverage },
      unmappedQuestions: {
        count: unmappedCount,
        sample: unmappedSample.map((q) => ({ id: q.id, content: stripToText(q.content) })),
      },
      orphanNodes: { count: orphanCount, sample: orphanSample },
      duplicateCandidates: dupRows.map((d) => ({ name: d.name, nodeIds: d.ids })),
      lowConfidenceMappings,
      overMappedQuestions: { count: overMappedRows.length, sample: overMappedRows },
      thinSkillNodes: { count: thinRows.length, sample: thinRows },
    };
  }

  // ═══════════════════════════════════════════════════
  // STUDENT LEARNING PATH (PDF §9 / §15 path endpoint)
  // ═══════════════════════════════════════════════════

  /** Prerequisite-ordered path to a target node, annotated with the student's mastery. */
  async getLearningPath(studentId: number, targetNodeId: number): Promise<LearningPathResponse> {
    const target = await prisma.knowledgeNode.findUnique({
      where: { id: targetNodeId },
      select: { id: true, name: true },
    });
    if (!target) return { target: null, steps: [] };

    // Walk PREREQUISITE_OF edges backward (prerequisite → target), up to 3 levels.
    const depthByNode = new Map<number, number>([[targetNodeId, 0]]);
    let frontier = [targetNodeId];
    for (let depth = 1; depth <= 3 && frontier.length > 0; depth++) {
      const rels = await prisma.knowledgeRelation.findMany({
        where: { relationType: 'PREREQUISITE_OF', toNodeId: { in: frontier } },
        select: { fromNodeId: true },
      });
      const next: number[] = [];
      for (const r of rels) {
        if (!depthByNode.has(r.fromNodeId)) {
          depthByNode.set(r.fromNodeId, depth);
          next.push(r.fromNodeId);
        }
      }
      frontier = next;
    }

    const ids = [...depthByNode.keys()];
    const [meta, mastery] = await Promise.all([
      prisma.knowledgeNode.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, type: true },
      }),
      prisma.studentKnowledgeMastery.findMany({
        where: { studentId, knowledgeNodeId: { in: ids } },
      }),
    ]);
    const metaById = new Map(meta.map((m) => [m.id, m]));
    const masteryByNode = new Map(mastery.map((m) => [m.knowledgeNodeId, m]));

    const built = ids
      .map((id) => {
        const m = metaById.get(id);
        const sk = masteryByNode.get(id);
        const attemptCount = sk?.attemptCount ?? 0;
        const masteryScore = sk?.masteryScore ?? 0;
        const weaknessLevel = weaknessLevelFromScore(masteryScore, attemptCount);
        const step: LearningPathStep = {
          nodeId: id,
          name: m?.name ?? `Node ${id}`,
          type: m?.type ?? 'SKILL',
          masteryScore,
          weaknessLevel,
          confidence: confidenceFromAttempts(attemptCount),
          attemptCount,
          isTarget: id === targetNodeId,
          needsWork:
            attemptCount === 0 || weaknessLevel === 'weak' || weaknessLevel === 'critical',
        };
        return { step, depth: depthByNode.get(id) ?? 0 };
      })
      // Deepest prerequisite first; the target (depth 0) comes last.
      .sort((a, b) => b.depth - a.depth);

    return { target: { nodeId: target.id, name: target.name }, steps: built.map((b) => b.step) };
  }

  // ═══════════════════════════════════════════════════
  // PRACTICE SETS (PDF §9 student practice, §10/§15 teacher assign)
  // A practice set reuses the normal Exam pipeline: an isPractice Exam built
  // from a node's questions, taken/graded/reviewed through existing flows.
  // ═══════════════════════════════════════════════════

  private async pickQuestionsForNode(
    nodeId: number,
    limit: number,
  ): Promise<{ questionIds: number[]; subjectId: number; nodeName: string } | null> {
    const node = await prisma.knowledgeNode.findUnique({
      where: { id: nodeId },
      select: { id: true, name: true, subjectId: true },
    });
    if (!node) return null;

    const questions = await prisma.question.findMany({
      where: { knowledgeLinks: { some: { knowledgeNodeId: nodeId } } },
      select: { id: true, subjectId: true },
      take: 300,
    });
    if (questions.length === 0) {
      return { questionIds: [], subjectId: node.subjectId ?? 0, nodeName: node.name };
    }

    // Fisher–Yates shuffle, then take up to `limit` (capped at 50).
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const chosen = shuffled.slice(0, Math.max(1, Math.min(limit, 50)));
    return {
      questionIds: chosen.map((q) => q.id),
      subjectId: node.subjectId ?? chosen[0].subjectId,
      nodeName: node.name,
    };
  }

  private async createPracticeExam(opts: {
    nodeId: number;
    nodeName: string;
    subjectId: number;
    questionIds: number[];
    createdBy: number;
    titlePrefix: string;
  }): Promise<{ examId: number; title: string; totalQuestions: number }> {
    const title = `${opts.titlePrefix}: ${opts.nodeName}`.slice(0, 200);
    const durationMin = Math.max(5, Math.ceil(opts.questionIds.length * 1.5));
    const exam = await prisma.exam.create({
      data: {
        title,
        subjectId: opts.subjectId,
        createdBy: opts.createdBy,
        durationMin,
        totalQuestions: opts.questionIds.length,
        shuffle: true,
        shuffleAnswers: true,
        showResult: true,
        maxAttempts: 5,
        status: 'PUBLISHED',
        isPractice: true,
        generatedFromNodeId: opts.nodeId,
        examQuestions: {
          create: opts.questionIds.map((qid, i) => ({ questionId: qid, orderIndex: i, points: 1 })),
        },
      },
      select: { id: true, title: true, totalQuestions: true },
    });
    return { examId: exam.id, title: exam.title, totalQuestions: exam.totalQuestions };
  }

  /** Student self-practice: build a personal practice set from a weak node. */
  async generateStudentPractice(
    studentId: number,
    nodeId: number,
    questionCount = 10,
  ): Promise<{ examId: number; title: string; totalQuestions: number }> {
    const picked = await this.pickQuestionsForNode(nodeId, questionCount);
    if (!picked) throw new AppError('Knowledge node not found', 404);
    if (picked.questionIds.length === 0) {
      throw new AppError('No questions are available for this skill yet', 400);
    }
    return this.createPracticeExam({
      nodeId,
      nodeName: picked.nodeName,
      subjectId: picked.subjectId,
      questionIds: picked.questionIds,
      createdBy: studentId,
      titlePrefix: 'Practice',
    });
  }

  /** Teacher: build a practice set from a weak node and assign it to a class. */
  async assignClassPractice(
    teacherId: number,
    classId: number,
    nodeId: number,
    questionCount = 10,
  ): Promise<{ examId: number; title: string; totalQuestions: number; classId: number }> {
    const cls = await prisma.class.findFirst({
      where: { id: classId, teacherId },
      select: { id: true },
    });
    if (!cls) throw new AppError('Class not found or unauthorized', 404);

    const picked = await this.pickQuestionsForNode(nodeId, questionCount);
    if (!picked) throw new AppError('Knowledge node not found', 404);
    if (picked.questionIds.length === 0) {
      throw new AppError('No questions are available for this skill yet', 400);
    }

    const exam = await this.createPracticeExam({
      nodeId,
      nodeName: picked.nodeName,
      subjectId: picked.subjectId,
      questionIds: picked.questionIds,
      createdBy: teacherId,
      titlePrefix: 'Targeted practice',
    });
    await prisma.examAssignment.create({
      data: { examId: exam.examId, classId, assignedBy: teacherId },
    });
    await invalidateClassKnowledgeGraphs();
    return { ...exam, classId };
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
