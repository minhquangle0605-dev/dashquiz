import type { ReactNode } from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'brand'
  | 'accent';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success:
    'bg-[var(--color-success-soft)] text-[var(--color-success)] ring-[var(--color-success)]/25',
  warning:
    'bg-[var(--color-warning-soft)] text-[var(--color-warning)] ring-[var(--color-warning)]/25',
  danger:
    'bg-[var(--color-danger-soft)] text-[var(--color-danger)] ring-[var(--color-danger)]/25',
  info:
    'bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-[var(--color-accent)]/25',
  neutral:
    'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] ring-[var(--color-border)]/40',
  brand:
    'bg-[var(--color-primary-soft)] text-[var(--color-primary)] ring-[var(--color-primary)]/25',
  accent:
    'bg-[var(--color-secondary-soft)] text-[var(--color-secondary)] ring-[var(--color-secondary)]/25',
};

const dotColorClasses: Record<BadgeVariant, string> = {
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  info: 'bg-[var(--color-accent)]',
  neutral: 'bg-[var(--color-text-muted)]',
  brand: 'bg-[var(--color-primary)]',
  accent: 'bg-[var(--color-secondary)]',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotColorClasses[variant]}`}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
