import type { ReactNode } from 'react';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  title?: string;
  padding?: CardPadding;
  children: ReactNode;
  className?: string;
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  title,
  padding = 'md',
  children,
  className = '',
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${paddingClasses[padding]} ${className}`}
    >
      {title !== undefined && title !== '' && (
        <h3 className="mb-4 text-lg font-semibold text-slate-900">{title}</h3>
      )}
      {children}
    </div>
  );
}
