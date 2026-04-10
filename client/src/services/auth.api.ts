import api from './api';
import type { LoginResponse, User } from '@/types/user';
import { API_ENDPOINTS, ROLES, type UserRole } from '@/utils/constants';

interface ServerLoginResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    user: User & { id: number | string };
  };
}

const KNOWN_ROLES: UserRole[] = [ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT, ROLES.PARENT];

function normalizeLoginUser(raw: User & { id: number | string }): User {
  const roleLower = String(raw.role).toLowerCase() as UserRole;
  const role = KNOWN_ROLES.includes(roleLower) ? roleLower : ROLES.STUDENT;
  return {
    ...raw,
    id: String(raw.id),
    role,
  };
}

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  const { data } = await api.post<ServerLoginResponse>(
    API_ENDPOINTS.AUTH.LOGIN,
    { username, password },
  );
  return {
    user: normalizeLoginUser(data.data.user),
    tokens: { accessToken: data.data.accessToken },
  };
}

export async function logout(): Promise<void> {
  await api.post(API_ENDPOINTS.AUTH.LOGOUT);
}
