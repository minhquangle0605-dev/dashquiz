import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Grid of "quick action" cards used at the top of a dashboard.
 * Layout inspired by Refine Finefoods dashboard (Material/Antd flavor):
 *   https://github.com/refinedev/refine/blob/main/examples/finefoods-material-ui/src/pages/dashboard/index.tsx
 * Re-implemented with Tailwind tokens used in this repo.
 */

export type QuickActionTone =
  | 'brand'
  | 'success'
  | 'warning'
  | 'info'
  | 'accent'
  | 'danger';

export interface QuickAction {
  label: string;
  description?: string;
  to?: string;
  onClick?: () => void;
  icon: ReactNode;
  tone?: QuickActionTone;
  badge?: ReactNode;
}

export interface QuickActionsGridProps {
  title?: string;
  subtitle?: string;
  actions: QuickAction[];
  className?: string;
}

const toneStyles: Record<QuickActionTone, { tint: string; iconBg: string; ring: string }> = {
  brand: {
    tint: 'group-hover:bg-[var(--color-primary-soft)]',
    iconBg: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    ring: 'group-hover:ring-[var(--color-primary)]/30',
  },
  success: {
    tint: 'group-hover:bg-[var(--color-success-soft)]',
    iconBg: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
    ring: 'group-hover:ring-[var(--color-success)]/30',
  },
  warning: {
    tint: 'group-hover:bg-[var(--color-warning-soft)]',
    iconBg: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    ring: 'group-hover:ring-[var(--color-warning)]/30',
  },
  info: {
    tint: 'group-hover:bg-[var(--color-accent-soft)]',
    iconBg: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
    ring: 'group-hover:ring-[var(--color-accent)]/30',
  },
  accent: {
    tint: 'group-hover:bg-[var(--color-secondary-soft)]',
    iconBg: 'bg-[var(--color-secondary-soft)] text-[var(--color-secondary)]',
    ring: 'group-hover:ring-[var(--color-secondary)]/30',
  },
  danger: {
    tint: 'group-hover:bg-[var(--color-danger-soft)]',
    iconBg: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    ring: 'group-hover:ring-[var(--color-danger)]/30',
  },
};

function ActionBody({ a }: { a: QuickAction }) {
  const t = toneStyles[a.tone ?? 'brand'];
  return (
    <>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors [&>svg]:h-5 [&>svg]:w-5 ${t.iconBg}`}
      >
        {a.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {a.label}
          </p>
          {a.badge}
        </div>
        {a.description && (
          <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
            {a.description}
          </p>
        )}
      </div>
      <svg
        className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-text-primary)]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </>
  );
}

export function QuickActionsGrid({
  title,
  subtitle,
  actions,
  className = '',
}: QuickActionsGridProps) {
  return (
    <section className={className}>
      {(title || subtitle) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => {
          const tone = toneStyles[a.tone ?? 'brand'];
          const baseClass = `group flex items-center gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-4 py-3 text-left shadow-[var(--shadow-sm)] ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] ${tone.ring}`;
          return a.to ? (
            <Link key={a.label} to={a.to} className={baseClass}>
              <ActionBody a={a} />
            </Link>
          ) : (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={baseClass}
            >
              <ActionBody a={a} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
