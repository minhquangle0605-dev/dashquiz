import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore, selectIsAuthenticated } from '@/stores/authStore';
import { ROLE_DASHBOARDS, ROUTES } from '@/utils/constants';
import type { AuthTokens, User } from '@/types/user';
import type { UserRole } from '@/utils/constants';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    const bufferMs = 30_000;
    return Date.now() >= payload.exp * 1000 - bufferMs;
  } catch {
    return true;
  }
}

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthFromStore = useAuthStore(selectIsAuthenticated);
  const loginAction = useAuthStore((s) => s.login);
  const logoutAction = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const isAuthenticated = useMemo(() => {
    if (!isAuthFromStore || !accessToken) return false;
    return !isTokenExpired(accessToken);
  }, [isAuthFromStore, accessToken]);

  const login = useCallback(
    (userData: User, tokens: AuthTokens) => {
      loginAction(userData, tokens);
      const dashboard = ROLE_DASHBOARDS[userData.role] ?? '/';
      navigate(dashboard, { replace: true });
    },
    [loginAction, navigate]
  );

  const logout = useCallback(() => {
    logoutAction();
    navigate(ROUTES.LOGIN, { replace: true });
  }, [logoutAction, navigate]);

  const hasRole = useCallback(
    (roles: UserRole | UserRole[]): boolean => {
      if (!user) return false;
      const allowed = Array.isArray(roles) ? roles : [roles];
      return allowed.includes(user.role);
    },
    [user]
  );

  return { user, isAuthenticated, login, logout, hasRole };
}
