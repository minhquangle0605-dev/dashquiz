import { useNavigate } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from '@/components/ui/DropdownMenu';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { ROUTES, type UserRole } from '@/utils/constants';

/**
 * Avatar with a popup menu — name+role at top, then quick actions.
 * Layout pattern from TailAdmin React:
 *   https://github.com/TailAdmin/free-react-tailwind-admin-dashboard/blob/main/src/components/header/UserMenu.tsx
 */

export interface UserMenuProps {
  roleLabel: string;
}

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function profileRoute(role?: UserRole): string {
  if (!role) return '/login';
  return `/${role}/profile`;
}

const iconUser = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);
const iconBell = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
    />
  </svg>
);
const iconSun = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);
const iconMoon = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    />
  </svg>
);
const iconLogout = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
    />
  </svg>
);
const iconChevron = (
  <svg
    className="h-3 w-3"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2.5}
    aria-hidden
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export function UserMenu({ roleLabel }: UserMenuProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const isDark = theme === 'dark';

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const goProfile = () => navigate(profileRoute(user?.role));
  const goNotifications = () => {
    if (user?.role) navigate(`/${user.role}/notifications`);
  };

  return (
    <DropdownMenu
      width={260}
      trigger={
        <button
          type="button"
          className="group flex items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-[var(--color-bg-muted)] focus-ring-brand"
          aria-label="Open user menu"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-xs font-bold text-white shadow-[var(--shadow-brand)] ring-2 ring-[var(--color-bg-card)]">
            {initials(user?.fullName)}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold leading-tight text-[var(--color-text-primary)]">
              {user?.fullName ?? 'Guest'}
            </p>
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              {roleLabel}
            </p>
          </div>
          <span className="hidden text-[var(--color-text-muted)] transition-transform group-aria-expanded:rotate-180 sm:inline-flex">
            {iconChevron}
          </span>
        </button>
      }
    >
      <DropdownLabel>Signed in as</DropdownLabel>
      <div className="px-3 pb-2">
        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {user?.fullName ?? 'Guest'}
        </p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">
          @{user?.username ?? '—'}
        </p>
      </div>
      <DropdownSeparator />
      <DropdownItem icon={iconUser} onClick={goProfile} shortcut="P">
        My profile
      </DropdownItem>
      <DropdownItem icon={iconBell} onClick={goNotifications}>
        Notifications
      </DropdownItem>
      <DropdownItem
        icon={isDark ? iconSun : iconMoon}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      >
        {isDark ? 'Light mode' : 'Dark mode'}
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem icon={iconLogout} destructive onClick={handleLogout}>
        Sign out
      </DropdownItem>
    </DropdownMenu>
  );
}
