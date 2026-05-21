import { useMemo, type ReactNode } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { getTimeBackground, getTimeTheme } from '@/utils/timeTheme';

/**
 * Personalized hero banner — greets by name + time of day, with optional
 * meta chips and a slot for a CTA.
 *
 * Composition idea borrowed from HyperUI's "Hero Banner" patterns:
 *   https://github.com/markmead/hyperui/tree/main/public/components/marketing/banners
 * combined with TailAdmin's dashboard greeting card.
 */

export interface GreetingMeta {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Optional accent color for the chip icon. */
  tone?: 'brand' | 'success' | 'warning' | 'info' | 'neutral';
}

export interface GreetingBannerProps {
  /** Override role-derived subtitle. */
  subtitle?: ReactNode;
  /** Up to 3-4 meta chips. */
  meta?: GreetingMeta[];
  /** Optional right-aligned CTA. */
  action?: ReactNode;
  /** Override the greeting text (e.g., "Welcome back to admin panel"). */
  title?: string;
  /** Override the hello name. */
  name?: string;
  className?: string;
}

const toneColor: Record<NonNullable<GreetingMeta['tone']>, string> = {
  brand: 'bg-white/15 text-white',
  success: 'bg-emerald-400/20 text-emerald-100',
  warning: 'bg-amber-400/20 text-amber-100',
  info: 'bg-cyan-300/20 text-cyan-50',
  neutral: 'bg-white/10 text-white/80',
};

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function GreetingBanner({
  subtitle,
  meta,
  action,
  title,
  name,
  className = '',
}: GreetingBannerProps) {
  const user = useAuthStore((s) => s.user);
  const theme = useMemo(() => getTimeTheme(), []);
  const today = useMemo(formatToday, []);

  const displayName = name ?? (user?.fullName ? user.fullName.split(' ').slice(-1)[0] : 'there');

  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow-lg)] sm:p-8 ${className}`}
      style={{ background: getTimeBackground(theme) }}
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden />

      <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
            {today}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:text-3xl">
            {title ?? (
              <>
                {theme.greeting}, {displayName} <span aria-hidden>{theme.emoji}</span>
              </>
            )}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-xl text-sm text-white/85">{subtitle}</p>
          )}

          {meta && meta.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {meta.map((m, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm ring-1 ring-inset ring-white/15 ${toneColor[m.tone ?? 'brand']}`}
                >
                  {m.icon && (
                    <span className="inline-flex h-3.5 w-3.5 [&>svg]:h-3.5 [&>svg]:w-3.5">
                      {m.icon}
                    </span>
                  )}
                  <span className="text-white/70">{m.label}:</span>
                  <span className="font-bold tabular-nums text-white">{m.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
