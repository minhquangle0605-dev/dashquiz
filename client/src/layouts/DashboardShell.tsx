import { useState, type ReactNode, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { CommandPalette } from '@/components/shared/CommandPalette';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { PageTransition } from '@/components/shared/PageTransition';
import { UserMenu } from '@/components/shared/UserMenu';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/utils/constants';
import { getTimeBackground, getTimeTheme } from '@/utils/timeTheme';

export type DashboardNavItem = {
  to: string;
  label: string;
  end?: boolean;
  icon: ReactNode;
};

type DashboardShellProps = {
  roleLabel: string;
  sidebarClassName: string;
  activeNavClassName: string;
  navItems: DashboardNavItem[];
  mobileNavItems?: DashboardNavItem[];
};

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  );
}

export function DashboardShell({
  roleLabel,
  sidebarClassName,
  activeNavClassName,
  navItems,
  mobileNavItems,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const logoutAction = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarBackground = useMemo(() => getTimeBackground(getTimeTheme()), []);

  const currentPageLabel = useMemo(() => {
    const exact = navItems.find((it) => it.to === location.pathname);
    if (exact) return exact.label;
    const partial = navItems
      .filter((it) => !it.end)
      .find((it) => location.pathname.startsWith(it.to));
    return partial?.label ?? '';
  }, [navItems, location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useKeyboardShortcuts({
    'ctrl+k': () => setCommandPaletteOpen((open) => !open),
    escape: () => setCommandPaletteOpen(false),
  });

  const handleLogout = () => {
    logoutAction();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center justify-between gap-2 border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 text-base font-black shadow-inner backdrop-blur-sm ring-1 ring-white/20">
            <span className="bg-gradient-to-br from-white via-white to-white/70 bg-clip-text text-transparent">W</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">WebQuiz</p>
              <p className="truncate text-[11px] font-medium uppercase tracking-wider text-white/60">
                {roleLabel}
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (mobileOpen) setMobileOpen(false);
            else setCollapsed((c) => !c);
          }}
          className="hidden rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:block"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? `${activeNavClassName} shadow-[var(--shadow-md)]`
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              } ${collapsed ? 'justify-center px-2' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors [&>svg]:h-5 [&>svg]:w-5 ${
                    isActive ? 'bg-white/20' : 'bg-white/10 group-hover:bg-white/15'
                  }`}
                >
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {isActive && !collapsed && (
                  <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout button */}
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Sign out' : undefined}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 transition-colors group-hover:bg-white/15">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </span>
          {!collapsed && <span className="truncate">Sign out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-page)]">
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/55 backdrop-blur-sm animate-fade-in lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — desktop */}
      <aside
        style={{ background: sidebarBackground }}
        className={`hidden lg:flex flex-col text-white shadow-[8px_0_24px_-12px_rgba(15,23,42,0.18)] transition-[width] duration-200 ease-out ${sidebarClassName} ${
          collapsed ? 'w-[4.5rem]' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar — mobile */}
      <aside
        style={{ background: sidebarBackground }}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col text-white shadow-2xl transition-transform duration-200 ease-out lg:hidden ${sidebarClassName} ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] glass px-4 sm:px-6">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)] lg:hidden"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Page breadcrumb */}
          {currentPageLabel && (
            <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {roleLabel}
              </span>
              <span className="text-[var(--color-border-strong)]">/</span>
              <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                {currentPageLabel}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden max-w-xs flex-1 items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3.5 py-2 text-sm text-[var(--color-text-muted)] transition-all hover:border-[var(--color-border)] hover:text-[var(--color-text-secondary)] focus-ring-brand md:flex"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span className="flex-1 text-left">Search…</span>
            <kbd className="hidden rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[var(--color-text-muted)] md:inline">
              Ctrl K
            </kbd>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <NotificationBell />
            <div className="h-6 w-px bg-[var(--color-border-subtle)]" aria-hidden />
            <UserMenu roleLabel={roleLabel} />
          </div>
        </header>
        <main
          className={`flex-1 overflow-auto p-4 sm:p-6 lg:p-8 ${
            mobileNavItems?.length ? 'pb-24 sm:pb-24 lg:pb-8' : ''
          }`}
        >
          <PageTransition transitionKey={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>

        {mobileNavItems?.length ? (
          <nav
            className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.45)] lg:hidden"
            aria-label={`${roleLabel} primary navigation`}
          >
            <div
              className="mx-auto grid max-w-md"
              style={{
                gridTemplateColumns: `repeat(${Math.min(mobileNavItems.length, 5)}, minmax(0, 1fr))`,
              }}
            >
              {mobileNavItems.slice(0, 5).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold transition-colors focus-ring-brand ${
                      isActive
                        ? 'text-[var(--color-primary)]'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg [&>svg]:h-5 [&>svg]:w-5 ${
                          isActive ? 'bg-[var(--color-primary-soft)]' : ''
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="max-w-full truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
