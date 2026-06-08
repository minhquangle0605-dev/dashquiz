// Mastery scoring helpers for the Knowledge Graph (PDF §7 "Mastery Model Upgrade").
//
// The mastery score is a difficulty-weighted, uncertainty-shrunk accuracy:
//   • harder questions count more than easy ones (difficulty weight),
//   • the score is pulled toward a 0.5 prior when evidence is thin, so a node
//     measured by one lucky answer never shows as fully mastered.
// Recency is handled separately (read-side) as a "stale" flag + days-since,
// because a stored score is always fresh at write time and only ages later.

export type WeaknessLevel =
  | 'critical'
  | 'weak'
  | 'medium'
  | 'good'
  | 'strong'
  | 'unknown';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

/** A skill counts as "stale" (due for spaced review) after this many days idle. */
export const STALE_AFTER_DAYS = 21;

/** Map a 0–100 mastery score to a weakness level (thresholds mirror the client). */
export function weaknessLevelFromScore(masteryScore: number, attemptCount: number): WeaknessLevel {
  if (attemptCount <= 0) return 'unknown';
  if (masteryScore < 40) return 'critical';
  if (masteryScore < 60) return 'weak';
  if (masteryScore < 75) return 'medium';
  if (masteryScore < 90) return 'good';
  return 'strong';
}

/**
 * Confidence in a mastery score, derived from how many answers back it
 * (PDF §16: "Mastery should never be shown without confidence or evidence
 * count"). Shown next to the score so users do not over-read a node measured
 * by only one or two questions.
 */
export function confidenceFromAttempts(attemptCount: number): ConfidenceLevel {
  if (attemptCount >= 10) return 'high';
  if (attemptCount >= 4) return 'medium';
  return 'low';
}

export interface MasteryInput {
  /** Raw number of correct answers across the node's questions. */
  correctCount: number;
  /** Raw number of answers. */
  attemptCount: number;
  /** Σ (difficulty × link-weight) over correct answers. */
  weightedCorrect: number;
  /** Σ (difficulty × link-weight) over all answers. */
  weightSum: number;
}

// Bayesian shrinkage: blend observed performance with a neutral 0.5 prior worth
// PRIOR_PSEUDO_OBS pseudo-answers, so low-evidence nodes regress toward the mean.
const PRIOR_MEAN = 0.5;
const PRIOR_PSEUDO_OBS = 2;

/** Compute difficulty-weighted, uncertainty-shrunk mastery from raw counts. */
export function computeMastery(input: MasteryInput) {
  const { correctCount, attemptCount, weightedCorrect, weightSum } = input;
  const accuracyRate = attemptCount > 0 ? correctCount / attemptCount : 0; // 0..1 raw

  // Fall back to unweighted counts if difficulty data is missing (weightSum 0).
  const obsCorrect = weightSum > 0 ? weightedCorrect : correctCount;
  const obsTotal = weightSum > 0 ? weightSum : attemptCount;
  const avgWeight = attemptCount > 0 && obsTotal > 0 ? obsTotal / attemptCount : 1;
  const priorWeight = PRIOR_PSEUDO_OBS * avgWeight;

  const shrunk =
    obsTotal + priorWeight > 0
      ? (obsCorrect + PRIOR_MEAN * priorWeight) / (obsTotal + priorWeight)
      : 0;
  const masteryScore = Math.round(shrunk * 100 * 10) / 10; // 0..100, 1 dp

  return {
    accuracyRate: Math.round(accuracyRate * 1000) / 1000,
    masteryScore,
    weaknessLevel: weaknessLevelFromScore(masteryScore, attemptCount),
    confidence: confidenceFromAttempts(attemptCount),
  };
}

/** Whole days since a timestamp (null when never practised). */
export function daysSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** A measured node is "stale" once it has not been practised for STALE_AFTER_DAYS. */
export function isStale(lastAttemptAt: Date | string | null | undefined): boolean {
  const d = daysSince(lastAttemptAt);
  return d != null && d >= STALE_AFTER_DAYS;
}

/** Human-readable reason string for a recommendation (no answer content leaked). */
export function recommendationReason(masteryScore: number, attemptCount: number): string {
  const pct = Math.round(masteryScore);
  if (attemptCount < 4) return `Only ${attemptCount} question(s) answered — practice more to confirm`;
  if (masteryScore < 40) return `Mastery ${pct}% — needs urgent review`;
  if (masteryScore < 60) return `Mastery ${pct}% — review and targeted practice`;
  return `Mastery ${pct}% — keep practising to reach mastery`;
}
