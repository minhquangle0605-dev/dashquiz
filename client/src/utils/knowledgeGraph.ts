import type { WeaknessLevel } from '@/services/knowledgeGraph.api';

// Shared presentation helpers for the Knowledge Graph pages (student/teacher/admin).

/** The five measured levels (everything except 'unknown'). */
export type MeasuredLevel = 'critical' | 'weak' | 'medium' | 'good' | 'strong';

export const LEVEL_ORDER: MeasuredLevel[] = ['critical', 'weak', 'medium', 'good', 'strong'];

export const LEVEL_LABEL: Record<WeaknessLevel, string> = {
  critical: 'Critical',
  weak: 'Weak',
  medium: 'Medium',
  good: 'Good',
  strong: 'Strong',
  unknown: 'No data',
};

/** Pill/badge classes (background + text) for a weakness level. */
export const LEVEL_BADGE: Record<WeaknessLevel, string> = {
  critical: 'bg-rose-100 text-rose-700',
  weak: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  good: 'bg-lime-100 text-lime-700',
  strong: 'bg-emerald-100 text-emerald-700',
  unknown: 'bg-slate-100 text-slate-500',
};

/** Solid swatch classes for heatmap cells / progress bars. */
export const LEVEL_SWATCH: Record<WeaknessLevel, string> = {
  critical: 'bg-rose-500',
  weak: 'bg-orange-500',
  medium: 'bg-amber-400',
  good: 'bg-lime-500',
  strong: 'bg-emerald-500',
  unknown: 'bg-slate-200',
};

/** Raw hex per level — for Chart.js canvases (which can't read Tailwind classes). */
export const LEVEL_HEX: Record<WeaknessLevel, string> = {
  critical: '#f43f5e',
  weak: '#f97316',
  medium: '#fbbf24',
  good: '#84cc16',
  strong: '#10b981',
  unknown: '#cbd5e1',
};

/** Map a 0–100 mastery score to its level (mirrors server scoring thresholds). */
export function levelFromScore(score: number, attemptCount: number): WeaknessLevel {
  if (attemptCount <= 0) return 'unknown';
  if (score < 40) return 'critical';
  if (score < 60) return 'weak';
  if (score < 75) return 'medium';
  if (score < 90) return 'good';
  return 'strong';
}

export const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
};
