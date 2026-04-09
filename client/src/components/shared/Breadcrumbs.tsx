import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';
import { ROLE_DASHBOARDS, type UserRole } from '@/utils/constants';

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  /** Dashboard route for the home icon; defaults from signed-in user role */
  homeTo?: string;
};

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function ChevronSeparator() {
  return (
    <span className="mx-1 text-slate-400 select-none" aria-hidden>
      &gt;
    </span>
  );
}

type Crumb = BreadcrumbItem & { key: string; isHome?: boolean };

function buildCrumbs(items: BreadcrumbItem[], homeHref: string): Crumb[] {
  return [
    { key: 'home', label: 'Home', to: homeHref, isHome: true },
    ...items.map((item, i) => ({ ...item, key: `crumb-${i}` })),
  ];
}

function CrumbSegment({ crumb, isCurrent }: { crumb: Crumb; isCurrent: boolean }) {
  const isHome = crumb.isHome;

  if (isCurrent || crumb.to === undefined) {
    return (
      <span
        className={`inline-flex min-h-9 max-w-[min(100%,12rem)] items-center gap-1 truncate text-sm font-medium text-slate-900 sm:max-w-none ${
          isHome ? 'min-w-9 justify-center' : ''
        }`}
        aria-current={isCurrent ? 'page' : undefined}
        aria-label={isHome && isCurrent ? 'Home' : undefined}
      >
        {isHome ? <HomeIcon className="h-4 w-4 shrink-0 text-slate-500" /> : crumb.label}
      </span>
    );
  }

  return (
    <NavLink
      to={crumb.to}
      aria-label={isHome ? 'Home' : undefined}
      className={({ isActive }) =>
        `inline-flex min-h-9 max-w-[min(100%,12rem)] items-center gap-1 truncate text-sm font-medium transition-colors hover:text-slate-700 sm:max-w-none ${
          isActive ? 'text-slate-700' : 'text-slate-500'
        } ${isHome ? 'min-w-9 justify-center' : ''}`
      }
      end={isHome}
    >
      {isHome ? <HomeIcon className="h-4 w-4 shrink-0" /> : crumb.label}
    </NavLink>
  );
}

function useNarrowMobile(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return narrow;
}

function defaultHomeForRole(role: UserRole | undefined): string {
  if (!role) return '/';
  return ROLE_DASHBOARDS[role];
}

export function Breadcrumbs({ items, homeTo }: BreadcrumbsProps) {
  const user = useAuthStore((s) => s.user);
  const resolvedHome = homeTo ?? defaultHomeForRole(user?.role);
  const crumbs = buildCrumbs(items, resolvedHome);
  const narrow = useNarrowMobile();

  const collapsed = narrow && crumbs.length > 3;
  const visible: Array<Crumb | { key: 'ellipsis'; label: string }> = collapsed
    ? [
        { key: 'ellipsis', label: '…' },
        crumbs[crumbs.length - 2]!,
        crumbs[crumbs.length - 1]!,
      ]
    : crumbs;

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center">
      <ol className="flex flex-wrap items-center gap-0">
        {visible.map((crumb, index) => {
          const isEllipsis = crumb.key === 'ellipsis';
          const isLast = index === visible.length - 1;

          return (
            <li key={crumb.key} className="flex items-center">
              {index > 0 ? <ChevronSeparator /> : null}
              {isEllipsis ? (
                <span className="px-1 text-sm font-medium text-slate-400 select-none" aria-hidden>
                  …
                </span>
              ) : (
                <CrumbSegment crumb={crumb as Crumb} isCurrent={isLast} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
