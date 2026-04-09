type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

const config: Record<DifficultyLevel, { label: string; style: string }> = {
  1: { label: 'Very Easy', style: 'bg-sky-100 text-sky-800 ring-sky-500/20' },
  2: { label: 'Easy', style: 'bg-emerald-100 text-emerald-800 ring-emerald-500/20' },
  3: { label: 'Medium', style: 'bg-amber-100 text-amber-900 ring-amber-500/20' },
  4: { label: 'Hard', style: 'bg-orange-100 text-orange-900 ring-orange-500/20' },
  5: { label: 'Very Hard', style: 'bg-red-100 text-red-800 ring-red-500/20' },
};

export interface DifficultyBadgeProps {
  level: DifficultyLevel;
  showLabel?: boolean;
  className?: string;
}

export function DifficultyBadge({
  level,
  showLabel = true,
  className = '',
}: DifficultyBadgeProps) {
  const { label, style } = config[level] ?? config[3];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style} ${className}`}
      title={`Difficulty: ${label} (${level}/5)`}
    >
      {showLabel ? label : `L${level}`}
    </span>
  );
}

export const DIFFICULTY_OPTIONS: Array<{ value: DifficultyLevel; label: string }> = [
  { value: 1, label: 'Very Easy' },
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Very Hard' },
];
