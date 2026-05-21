import type { ReactNode } from 'react';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardVariant = 'default' | 'elevated' | 'soft' | 'gradient' | 'outline';

export interface CardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  padding?: CardPadding;
  variant?: CardVariant;
  hoverable?: boolean;
  children: ReactNode;
  className?: string;
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const variantClasses: Record<CardVariant, string> = {
  default:
    'bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]',
  elevated:
    'bg-[var(--color-bg-card-raised)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-md)]',
  soft:
    'bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)]',
  gradient:
    'border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)] bg-gradient-brand-soft',
  outline:
    'bg-transparent border border-[var(--color-border)]',
};

export function Card({
  title,
  subtitle,
  action,
  padding = 'md',
  variant = 'default',
  hoverable = false,
  children,
  className = '',
}: CardProps) {
  const hoverClass = hoverable ? 'card-lift cursor-pointer' : '';
  return (
    <div
      className={`rounded-2xl ${variantClasses[variant]} ${paddingClasses[padding]} ${hoverClass} ${className}`}
    >
      {(title !== undefined && title !== '') || subtitle || action ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title !== undefined && title !== '' && (
              <h3 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      ) : null}
      {children}
    </div>
  );
}
