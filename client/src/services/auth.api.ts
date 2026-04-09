import api from './api';
import type { LoginResponse, User } from '@/types/user';
import { API_ENDPOINTS } from '@/utils/constants';

interface ServerLoginResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    user: User;
  };
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const { data } = await api.post<ServerLoginResponse>(
    API_ENDPOINTS.AUTH.LOGIN,
    { email, password },
  );
  return {
    user: data.data.user,
    tokens: { accessToken: data.data.accessToken },
  };
}

export async function logout(): Promise<void> {
  await api.post(API_ENDPOINTS.AUTH.LOGOUT);
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
}

export async function resetPassword(
  token: string,
  password: string
): Promise<void> {
  await api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, { token, password });
}
