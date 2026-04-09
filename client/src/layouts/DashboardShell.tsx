import { useState, type ReactNode, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/utils/constants';

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
};

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
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
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logoutAction = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logoutAction();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center justify-between gap-2 border-b border-white/10 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
            W
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">WebQuiz</p>
              <p className="truncate text-xs text-white/70">{roleLabel}</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (mobileOpen) setMobileOpen(false);
            else setCollapsed((c) => !c);
          }}
          className="hidden rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white lg:block"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? activeNavClassName
                  : 'text-slate-200/90 hover:bg-white/10 hover:text-white'
              } ${collapsed ? 'justify-center px-2' : ''}`
            }
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 [&>svg]:h-5 [&>svg]:w-5">
              {item.icon}
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout button */}
      <div className="border-t border-white/10 p-2">
        <button
          type="button"
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200/90 transition-colors hover:bg-white/10 hover:text-white ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Sign out' : undefined}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10">
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
    <div className="flex min-h-screen bg-slate-100">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — desktop */}
      <aside
        className={`hidden lg:flex flex-col border-r border-white/10 text-white shadow-lg transition-[width] duration-200 ease-out ${sidebarClassName} ${
          collapsed ? 'w-[4.25rem]' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar — mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 text-white shadow-xl transition-transform duration-200 ease-out lg:hidden ${sidebarClassName} ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <p className="hidden text-sm font-medium text-slate-500 lg:block">
            High School Learning Analytics
          </p>

          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-slate-600 sm:inline">
                {user.fullName}
              </span>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white ring-2 ring-white">
              {user?.fullName
                ? user.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                : '?'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
