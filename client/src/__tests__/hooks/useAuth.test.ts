import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/stores/authStore', () => {
  let state = {
    user: null as { id: number; username: string; role: string; fullName: string } | null,
    accessToken: null as string | null,
  };

  const store = {
    getState: () => state,
    setState: (partial: Partial<typeof state>) => {
      state = { ...state, ...partial };
    },
  };

  return {
    useAuthStore: (selector: (s: typeof state & { login: Function; logout: Function }) => unknown) => {
      const storeWithActions = {
        ...state,
        login: (user: typeof state.user, tokens: { accessToken: string }) => {
          state.user = user;
          state.accessToken = tokens.accessToken;
        },
        logout: () => {
          state.user = null;
          state.accessToken = null;
        },
      };
      return selector(storeWithActions);
    },
    selectIsAuthenticated: (s: typeof state) => s.user !== null && s.accessToken !== null,
    __store: store,
  };
});

vi.mock('@/utils/constants', () => ({
  ROLE_DASHBOARDS: {
    student: '/student/dashboard',
    teacher: '/teacher/dashboard',
    admin: '/admin/dashboard',
    parent: '/parent/dashboard',
  },
  ROUTES: { LOGIN: '/login' },
}));

import { useAuth } from '@/hooks/useAuth';

describe('useAuth hook', () => {
  beforeEach(async () => {
    const { __store } = await import('@/stores/authStore') as any;
    __store.setState({ user: null, accessToken: null });
  });

  it('should return isAuthenticated false when no user', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should return hasRole function', () => {
    const { result } = renderHook(() => useAuth());

    expect(typeof result.current.hasRole).toBe('function');
    expect(result.current.hasRole('student')).toBe(false);
  });

  it('should provide login function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.login).toBe('function');
  });

  it('should provide logout function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.logout).toBe('function');
  });
});
