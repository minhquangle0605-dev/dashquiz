import { create } from 'zustand';

import type { AuthTokens, User } from '@/types/user';

const ACCESS_TOKEN_KEY = 'accessToken';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthActions {
  login: (userData: User, tokens: AuthTokens) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
}

export type AuthStore = AuthState & AuthActions;

function persistAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export const selectIsAuthenticated = (state: AuthStore): boolean =>
  state.user !== null &&
  state.accessToken !== null &&
  state.accessToken.length > 0;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,

  login: (userData, tokens) => {
    persistAccessToken(tokens.accessToken);
    set({
      user: userData,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  },

  logout: () => {
    persistAccessToken(null);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  },

  setUser: (user) => set({ user }),
}));

/** Call after a successful refresh-token exchange (keeps localStorage in sync). */
export function syncTokensFromRefresh(tokens: AuthTokens): void {
  persistAccessToken(tokens.accessToken);
  useAuthStore.setState({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
}
