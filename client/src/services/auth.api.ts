import api from './api';
import type { LoginResponse } from '@/types/user';
import { API_ENDPOINTS } from '@/utils/constants';

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, {
    email,
    password,
  });
  return data;
}

export async function logout(): Promise<void> {
  await api.post(API_ENDPOINTS.AUTH.LOGOUT);
}

export async function refreshToken(
  token: string
): Promise<{ accessToken: string }> {
  const { data } = await api.post<{ accessToken: string }>(
    API_ENDPOINTS.AUTH.REFRESH,
    { refreshToken: token }
  );
  return data;
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
