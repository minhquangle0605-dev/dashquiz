import { GradingMethod, Prisma } from '@prisma/client';

export type GradingMethodName = keyof typeof GradingMethod;

export interface ScorableAttempt {
  totalScore: Prisma.Decimal | number | null;
  startedAt: Date | string;
}

/**
 * Derive the final grade for an exam from a set of completed attempts,
 * following the exam's configured grading method (§5 of the plan):
 *   - HIGHEST: best score across attempts
 *   - AVERAGE: mean of all attempt scores
 *   - FIRST:   score of the earliest attempt
 *   - LAST:    score of the most recent attempt
 *
 * Attempts with a null totalScore are ignored. Returns null when there is
 * no scorable attempt so callers can distinguish "not attempted yet".
 */
export function computeFinalScore(
  attempts: ScorableAttempt[],
  method: GradingMethodName | GradingMethod = GradingMethod.HIGHEST,
): number | null {
  const scored = attempts
    .filter((a) => a.totalScore !== null && a.totalScore !== undefined)
    .map((a) => ({
      score: Number(a.totalScore),
      startedAt: new Date(a.startedAt).getTime(),
    }))
    .filter((a) => Number.isFinite(a.score));

  if (scored.length === 0) return null;

  switch (method) {
    case GradingMethod.AVERAGE: {
      const sum = scored.reduce((acc, a) => acc + a.score, 0);
      return roundScore(sum / scored.length);
    }
    case GradingMethod.FIRST: {
      const first = scored.reduce((earliest, a) =>
        a.startedAt < earliest.startedAt ? a : earliest,
      );
      return roundScore(first.score);
    }
    case GradingMethod.LAST: {
      const last = scored.reduce((latest, a) =>
        a.startedAt >= latest.startedAt ? a : latest,
      );
      return roundScore(last.score);
    }
    case GradingMethod.HIGHEST:
    default:
      return roundScore(Math.max(...scored.map((a) => a.score)));
  }
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
