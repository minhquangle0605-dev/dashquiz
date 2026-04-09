import { Outlet, Navigate } from 'react-router-dom';

import { useAuthStore, selectIsAuthenticated } from '@/stores/authStore';
import { ROLE_DASHBOARDS } from '@/utils/constants';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (isAuthenticated && user) {
    const dashboard = ROLE_DASHBOARDS[user.role] ?? '/';
    return <Navigate to={dashboard} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      {/* Left brand panel */}
      <div className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-8 py-10 text-white lg:w-[480px] lg:px-12">
        {/* Background decorations */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-10 bottom-10 h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-2xl" />
        </div>

        <div className="relative z-10">
          {/* Logo area */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur-sm">
              W
            </div>
            <span className="text-sm font-bold tracking-wider uppercase text-white/90">
              WebQuiz
            </span>
          </div>

          <h1 className="mt-10 text-3xl font-bold leading-tight sm:text-4xl">
            High School Learning Analytics
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
            Track progress, exam results, and practice — a single platform
            for students, teachers, parents, and administrators.
          </p>

          {/* Feature highlights */}
          <div className="mt-8 space-y-3">
            {[
              'Real-time exam analytics and insights',
              'AI-powered adaptive practice sessions',
              'Multi-role dashboard for all stakeholders',
            ].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span className="text-sm text-white/85">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 mt-8 text-xs text-white/50 lg:mt-0">
          &copy; {new Date().getFullYear()} WebQuiz &mdash; High School Learning Analytics Dashboard
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
