// Mastery scoring helpers for the Knowledge Graph (PDF §6).
// MVP formula: masteryScore = (correctCount / attemptCount) * 100.
// The advanced formula (recency / speed / consistency) can be layered on later.

export type WeaknessLevel =
  | 'critical'
  | 'weak'
  | 'medium'
  | 'good'
  | 'strong'
  | 'unknown';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

/** Map a 0–100 mastery score to a weakness level (PDF §6.1). */
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
 * (PDF §15: "too few attempts → unreliable score"). Shown next to the score so
 * users do not over-read a node measured by only one or two questions.
 */
export function confidenceFromAttempts(attemptCount: number): ConfidenceLevel {
  if (attemptCount >= 10) return 'high';
  if (attemptCount >= 4) return 'medium';
  return 'low';
}

/** Compute mastery numbers from raw correct/total counts. */
export function computeMastery(correctCount: number, attemptCount: number) {
  const accuracyRate = attemptCount > 0 ? correctCount / attemptCount : 0; // 0..1
  const masteryScore = Math.round(accuracyRate * 100 * 10) / 10; // 0..100, 1 dp
  return {
    accuracyRate: Math.round(accuracyRate * 1000) / 1000,
    masteryScore,
    weaknessLevel: weaknessLevelFromScore(masteryScore, attemptCount),
    confidence: confidenceFromAttempts(attemptCount),
  };
}

/** Human-readable reason string for a recommendation (no answer content leaked). */
export function recommendationReason(masteryScore: number, attemptCount: number): string {
  const pct = Math.round(masteryScore);
  if (attemptCount < 4) return `Only ${attemptCount} question(s) answered — practice more to confirm`;
  if (masteryScore < 40) return `Accuracy ${pct}% — needs urgent review`;
  if (masteryScore < 60) return `Accuracy ${pct}% — review and targeted practice`;
  return `Accuracy ${pct}% — keep practising to reach mastery`;
}
