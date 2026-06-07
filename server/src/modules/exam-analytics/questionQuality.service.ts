import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';

// Question review workflow + cross-exam quality aggregation (PDF §4/§5).

export const REVIEW_STATUSES = [
  'needs_review',
  'needs_revision',
  'approved',
  'good',
  'rejected',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// Derive a suggested quality flag from the question's pooled stats (same PDF
// thresholds as the per-exam flag, but over all exams that used the item).
function aggregateFlag(
  correctRate: number | null,
  discrimination: number | null,
  attempts: number,
): string {
  if (attempts < 5 || correctRate === null) return 'insufficient_data';
  if (correctRate >= 0.9) return 'too_easy';
  if (correctRate <= 0.3) return 'too_hard';
  if (discrimination !== null && discrimination < 0.1) return 'needs_review';
  if (correctRate >= 0.4 && correctRate <= 0.85 && discrimination !== null && discrimination >= 0.2) {
    return 'good';
  }
  return 'ok';
}

export class QuestionQualityService {
  async getQuality(questionId: number) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        content: true,
        questionType: true,
        difficulty: true,
        review: {
          select: {
            status: true,
            qualityFlag: true,
            comment: true,
            reviewedAt: true,
            reviewerId: true,
          },
        },
      },
    });
    if (!question) throw new AppError('Question not found', 404);

    const stats = await prisma.questionStat.findMany({
      where: { questionId },
      select: {
        examId: true,
        attempts: true,
        correctRate: true,
        skippedRate: true,
        discriminationIndex: true,
        avgTimeSec: true,
        qualityFlag: true,
      },
    });

    let totalAttempts = 0;
    let weightedCorrect = 0;
    let discSum = 0;
    let discCount = 0;
    let timeSum = 0;
    let timeCount = 0;
    for (const s of stats) {
      totalAttempts += s.attempts;
      weightedCorrect += s.correctRate * s.attempts;
      if (s.discriminationIndex !== null) {
        discSum += s.discriminationIndex;
        discCount += 1;
      }
      if (s.avgTimeSec > 0) {
        timeSum += s.avgTimeSec * s.attempts;
        timeCount += s.attempts;
      }
    }
    const correctRate = totalAttempts > 0 ? weightedCorrect / totalAttempts : null;
    const discrimination = discCount > 0 ? Math.round((discSum / discCount) * 1000) / 1000 : null;
    const avgTimeSec = timeCount > 0 ? Math.round(timeSum / timeCount) : null;

    return {
      question: {
        id: question.id,
        content: question.content,
        questionType: question.questionType,
        difficulty: question.difficulty,
      },
      usage: { examCount: stats.length, totalAttempts },
      aggregate: {
        correctRate: correctRate !== null ? Math.round(correctRate * 1000) / 10 : null, // → %
        discrimination,
        avgTimeSec,
        suggestedFlag: aggregateFlag(correctRate, discrimination, totalAttempts),
      },
      review: question.review,
    };
  }

  async setReview(
    questionId: number,
    reviewerId: number,
    data: { status: string; qualityFlag?: string | null; comment?: string | null },
  ) {
    const exists = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!exists) throw new AppError('Question not found', 404);

    return prisma.questionReview.upsert({
      where: { questionId },
      create: {
        questionId,
        reviewerId,
        status: data.status,
        qualityFlag: data.qualityFlag ?? null,
        comment: data.comment ?? null,
      },
      update: {
        reviewerId,
        status: data.status,
        qualityFlag: data.qualityFlag ?? null,
        comment: data.comment ?? null,
        reviewedAt: new Date(),
      },
    });
  }
}

export const questionQualityService = new QuestionQualityService();
