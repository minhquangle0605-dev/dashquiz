import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

// ─────────────────────────────────────────────────────────────────────────────
// DUPLICATE DETECTION (PDF §10/§12/§14 — "normalized text + trigram/fuzzy")
//
// Exact + near-duplicate search over the question bank using the pg_trgm
// `similarity()` function and a GIN trigram index on questions.normalized_content.
// Never deletes or blocks automatically — it only surfaces matches so a teacher
// can skip on import or review clusters in the bank.
// ─────────────────────────────────────────────────────────────────────────────

const NEAR_THRESHOLD = 0.55; // import-time "looks similar"
const CLUSTER_THRESHOLD = 0.6; // bank-review "near duplicate"
const EXACTISH = 0.85; // at/above this we call it an exact duplicate
const MIN_NORM_LENGTH = 8; // shorter normalized text is too noisy to match

export type DuplicateMethod = 'exact' | 'near';

export interface DuplicateMatch {
  questionId: number;
  similarity: number;
  method: DuplicateMethod;
  contentPreview: string;
  questionType: string;
}

export interface DuplicatePair {
  a: { id: number; contentPreview: string; questionType: string };
  b: { id: number; contentPreview: string; questionType: string };
  similarity: number;
}

/**
 * Normalize rich-HTML question content for trigram matching: strip tags + entities,
 * lowercase, collapse whitespace. MUST mirror the SQL backfill in the migration so
 * new rows compare correctly against existing ones.
 */
export function normalizeForDedup(html: string | null | undefined): string {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripHtmlPreview(html: string, max = 160): string {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Find existing questions similar to the given text, scoped to a subject/chapter.
 * Returns the strongest matches (exact first, then near) above NEAR_THRESHOLD.
 */
export async function findDuplicateQuestions(
  content: string,
  opts: {
    subjectId?: number | null;
    chapterId?: number | null;
    excludeId?: number | null;
    threshold?: number;
    limit?: number;
  } = {},
): Promise<DuplicateMatch[]> {
  const norm = normalizeForDedup(content);
  if (norm.length < MIN_NORM_LENGTH) return [];

  const threshold = opts.threshold ?? NEAR_THRESHOLD;
  const limit = opts.limit ?? 3;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`q."normalized_content" % ${norm}`,
    Prisma.sql`similarity(q."normalized_content", ${norm}) >= ${threshold}`,
  ];
  if (opts.subjectId) conditions.push(Prisma.sql`q."subject_id" = ${opts.subjectId}`);
  if (opts.chapterId) conditions.push(Prisma.sql`q."chapter_id" = ${opts.chapterId}`);
  if (opts.excludeId) conditions.push(Prisma.sql`q."id" <> ${opts.excludeId}`);

  const rows = await prisma.$queryRaw<
    Array<{ id: number; content: string; question_type: string; sim: number }>
  >(Prisma.sql`
    SELECT q."id", q."content", q."question_type", similarity(q."normalized_content", ${norm}) AS sim
    FROM "questions" q
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY sim DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    questionId: r.id,
    similarity: round(r.sim),
    method: r.sim >= EXACTISH ? 'exact' : 'near',
    contentPreview: stripHtmlPreview(r.content),
    questionType: r.question_type,
  }));
}

/**
 * Find near-duplicate pairs already in the bank (optionally within one subject),
 * excluding pairs a teacher has already marked acceptable/dismissed/merged.
 */
export async function findDuplicateClusters(opts: {
  subjectId?: number | null;
  threshold?: number;
  limit?: number;
}): Promise<DuplicatePair[]> {
  const threshold = opts.threshold ?? CLUSTER_THRESHOLD;
  const limit = opts.limit ?? 50;

  const rows = await prisma.$queryRaw<
    Array<{
      a_id: number;
      a_content: string;
      a_type: string;
      b_id: number;
      b_content: string;
      b_type: string;
      sim: number;
    }>
  >(Prisma.sql`
    SELECT a."id" AS a_id, a."content" AS a_content, a."question_type" AS a_type,
           b."id" AS b_id, b."content" AS b_content, b."question_type" AS b_type,
           similarity(a."normalized_content", b."normalized_content") AS sim
    FROM "questions" a
    JOIN "questions" b
      ON a."id" < b."id"
      AND a."subject_id" = b."subject_id"
      AND a."normalized_content" % b."normalized_content"
    WHERE similarity(a."normalized_content", b."normalized_content") >= ${threshold}
      ${opts.subjectId ? Prisma.sql`AND a."subject_id" = ${opts.subjectId}` : Prisma.empty}
      AND length(a."normalized_content") >= ${MIN_NORM_LENGTH}
      AND NOT EXISTS (
        SELECT 1 FROM "question_duplicate_links" l
        WHERE l."status" IN ('acceptable', 'dismissed', 'merged')
          AND (
            (l."question_id" = a."id" AND l."duplicate_question_id" = b."id")
            OR (l."question_id" = b."id" AND l."duplicate_question_id" = a."id")
          )
      )
    ORDER BY sim DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    a: { id: r.a_id, contentPreview: stripHtmlPreview(r.a_content), questionType: r.a_type },
    b: { id: r.b_id, contentPreview: stripHtmlPreview(r.b_content), questionType: r.b_type },
    similarity: round(r.sim),
  }));
}

/** Record a reviewed duplicate decision so the pair stops re-flagging. */
export async function recordDuplicateDecision(
  questionId: number,
  duplicateQuestionId: number,
  status: 'acceptable' | 'dismissed' | 'merged',
  reviewedBy: number,
): Promise<void> {
  const [a, b] = questionId < duplicateQuestionId
    ? [questionId, duplicateQuestionId]
    : [duplicateQuestionId, questionId];
  await prisma.questionDuplicateLink.upsert({
    where: { questionId_duplicateQuestionId: { questionId: a, duplicateQuestionId: b } },
    create: { questionId: a, duplicateQuestionId: b, similarity: 0, method: 'trigram', status, reviewedBy },
    update: { status, reviewedBy },
  });
}
