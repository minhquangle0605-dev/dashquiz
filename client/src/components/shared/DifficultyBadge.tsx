import type { Question } from '@/types/question';

const difficultyStyles: Record<Question['difficulty'], string> = {
  1: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  2: 'bg-lime-100 text-lime-900 ring-lime-600/20',
  3: 'bg-amber-100 text-amber-900 ring-amber-600/20',
  4: 'bg-orange-100 text-orange-900 ring-orange-600/20',
  5: 'bg-red-100 text-red-800 ring-red-600/20',
};

export interface DifficultyBadgeProps {
  level: Question['difficulty'];
  className?: string;
}

export function DifficultyBadge({ level, className = '' }: DifficultyBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${difficultyStyles[level]} ${className}`}
      title={`Difficulty ${level} of 5`}
    >
      L{level}
    </span>
  );
}
