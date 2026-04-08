import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

export type DashboardNavItem = {
  to: string;
  label: string;
  end?: boolean;
  icon: ReactNode;
};

type DashboardShellProps = {
  /** Shown next to logo when sidebar expanded */
  roleLabel: string;
  /** Sidebar gradient / accent (Tailwind classes for aside background) */
  sidebarClassName: string;
  /** Active nav item highlight */
  activeNavClassName: string;
  navItems: DashboardNavItem[];
};

function collapseToggleIcon(collapsed: boolean) {
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

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside
        className={`flex flex-col border-r border-white/10 text-white shadow-lg transition-[width] duration-200 ease-out ${sidebarClassName} ${
          collapsed ? 'w-[4.25rem]' : 'w-60'
        }`}
      >
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
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapseToggleIcon(collapsed)}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6">
          <p className="text-sm font-medium text-slate-500">High School Learning Analytics</p>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">Chào mừng</span>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 ring-2 ring-white" />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
