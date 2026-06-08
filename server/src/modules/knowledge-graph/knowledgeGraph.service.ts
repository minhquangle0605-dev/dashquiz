import { Prisma } from '@prisma/client';

import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { cacheGet, cacheSet, cacheInvalidate } from '../../utils/cache';
import { AppError } from '../../middlewares/errorHandler';
import {
  computeMastery,
  confidenceFromAttempts,
  recommendationReason,
  weaknessLevelFromScore,
} from './knowledgeGraph.scoring';
import type {
  GraphEdge,
  GraphNode,
  GraphSummary,
  Recommendation,
  StudentGraphResponse,
} from './knowledgeGraph.types';

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
        avgTimeSec: number | null;
        lastAttemptAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT qkn."knowledge_node_id" AS "nodeId",
             COUNT(*)::int AS "attemptCount",
             SUM(CASE WHEN aa."is_correct" THEN 1 ELSE 0 END)::int AS "correctCount",
             AVG(aa."time_spent_sec")::float AS "avgTimeSec",
             MAX(ea."submitted_at") AS "lastAttemptAt"
      FROM "attempt_answers" aa
      JOIN "exam_attempts" ea ON ea."id" = aa."attempt_id"
      JOIN "question_knowledge_nodes" qkn ON qkn."question_id" = aa."question_id"
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
      const m = computeMastery(r.correctCount, r.attemptCount);
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

    const recommendations = this.buildRecommendations(graphNodes);

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

  private buildRecommendations(nodes: GraphNode[]): Recommendation[] {
    return nodes
      .filter(
        (n) =>
          n.attemptCount > 0 &&
          (n.weaknessLevel === 'critical' || n.weaknessLevel === 'weak') &&
          n.type !== 'SUBJECT',
      )
      .sort((a, b) => a.masteryScore - b.masteryScore || b.attemptCount - a.attemptCount)
      .slice(0, 6)
      .map((n) => ({
        nodeId: n.id,
        name: n.name,
        type: n.type,
        subjectId: n.subjectId,
        masteryScore: n.masteryScore,
        reason: recommendationReason(n.masteryScore, n.attemptCount),
        priority: n.weaknessLevel === 'critical' ? ('high' as const) : ('medium' as const),
      }));
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
      include: { _count: { select: { questionLinks: true, children: true } } },
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
}

export const knowledgeGraphService = new KnowledgeGraphService();
