import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Refined KPI/stat tile with optional trend delta and an animated counter.
 * Visual pattern inspired by Tremor's `Card` + `Metric` + `BadgeDelta`:
 *   https://github.com/tremorlabs/tremor/blob/main/src/components/text-elements/Metric/Metric.tsx
 */

export type StatTone =
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent'
  | 'neutral';

export interface StatTileProps {
  label: string;
  value: number | string;
  /** Optional caption under the value (e.g., latest exam title). */
  hint?: ReactNode;
  /** Icon node — should be 24x24 svg. */
  icon: ReactNode;
  tone?: StatTone;
  /** Delta in percent (positive or negative). Renders a colored chip. */
  deltaPct?: number;
  /** Optional label for the delta context (e.g., "vs last 30d"). */
  deltaLabel?: string;
  /** When true, smoothly animates the number from 0 to its value. */
  animate?: boolean;
  /** Decimal places for animated numeric values. */
  decimals?: number;
  className?: string;
}

const toneStyles: Record<StatTone, { tint: string; glow: string }> = {
  brand: {
    tint: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    glow: 'from-indigo-500 to-violet-600',
  },
  success: {
    tint: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
    glow: 'from-emerald-500 to-teal-600',
  },
  warning: {
    tint: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    glow: 'from-amber-500 to-orange-600',
  },
  danger: {
    tint: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    glow: 'from-red-500 to-rose-600',
  },
  info: {
    tint: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
    glow: 'from-cyan-500 to-blue-600',
  },
  accent: {
    tint: 'bg-[var(--color-secondary-soft)] text-[var(--color-secondary)]',
    glow: 'from-fuchsia-500 to-purple-600',
  },
  neutral: {
    tint: 'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]',
    glow: 'from-slate-400 to-slate-600',
  },
};

function useCountUp(target: number, enabled: boolean, decimals: number) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    const duration = 900;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, enabled]);

  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  deltaPct,
  deltaLabel,
  animate = true,
  decimals = 0,
  className = '',
}: StatTileProps) {
  const isNumeric = typeof value === 'number';
  const animated = useCountUp(
    isNumeric ? (value as number) : 0,
    animate && isNumeric,
    decimals,
  );

  const display = isNumeric
    ? animated.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : value;

  const t = toneStyles[tone];

  return (
    <div
      className={`card-lift group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)] ${className}`}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${t.glow} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`}
        aria-hidden
      />
      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${t.tint} [&>svg]:h-6 [&>svg]:w-6`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              {label}
            </p>
            {typeof deltaPct === 'number' && Number.isFinite(deltaPct) && (
              <DeltaChip pct={deltaPct} />
            )}
          </div>
          <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-[var(--color-text-primary)]">
            {display}
          </p>
          {(hint || deltaLabel) && (
            <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
              {hint ?? deltaLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DeltaChip({ pct }: { pct: number }) {
  const rounded = Math.round(pct);
  const isUp = rounded > 0;
  const isFlat = rounded === 0;
  const tone = isFlat
    ? 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]'
    : isUp
      ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
      : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]';
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tone}`}
    >
      {!isFlat && (
        <svg
          className={`h-2.5 w-2.5 ${isUp ? '' : 'rotate-180'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M10 3l-7 7h4v7h6v-7h4l-7-7z" />
        </svg>
      )}
      {isUp && '+'}
      {rounded}%
    </span>
  );
}
