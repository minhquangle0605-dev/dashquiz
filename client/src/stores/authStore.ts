import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { AuthTokens, User } from '@/types/user';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
}

interface AuthActions {
  login: (userData: User, tokens: AuthTokens) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string) => void;
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

      login: (userData, tokens) => {
        set({
          user: userData,
          accessToken: tokens.accessToken,
        });
      },

      logout: () => {
        set({ user: null, accessToken: null });
      },

      setUser: (user) => set({ user }),

      setAccessToken: (token) => set({ accessToken: token }),
    }),
    {
      name: 'webquiz-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
);

export function syncTokensFromRefresh(tokens: AuthTokens): void {
  useAuthStore.getState().setAccessToken(tokens.accessToken);
}
