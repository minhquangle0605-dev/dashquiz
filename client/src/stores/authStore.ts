import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { AuthTokens, User } from '@/types/user';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthActions {
  login: (userData: User, tokens: AuthTokens) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens) => void;
}

export type AuthStore = AuthState & AuthActions;

export const selectIsAuthenticated = (state: AuthStore): boolean =>
  state.user !== null &&
  state.accessToken !== null &&
  state.accessToken.length > 0;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      login: (userData, tokens) => {
        set({
          user: userData,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
        });
      },

      setUser: (user) => set({ user }),

      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }),
    }),
    {
      name: 'webquiz-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

export function syncTokensFromRefresh(tokens: AuthTokens): void {
  useAuthStore.getState().setTokens(tokens);
}
