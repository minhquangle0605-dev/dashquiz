import { useAuthStore, selectIsAuthenticated } from '@/stores/authStore';
import type { AuthTokens, User } from '@/types/user';

export function useAuth(): {
  user: User | null;
  isAuthenticated: boolean;
  login: (userData: User, tokens: AuthTokens) => void;
  logout: () => void;
} {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  return { user, isAuthenticated, login, logout };
}
