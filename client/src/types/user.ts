import type { UserRole } from '@/utils/constants';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  avatar?: string;
  status?: UserStatus;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}
