import api from './api';
import type { User } from '@/types/user';
import { API_ENDPOINTS } from '@/utils/constants';

export interface UpdateProfilePayload {
  fullName: string;
  phone?: string;
}

export async function getProfile(): Promise<User> {
  const { data } = await api.get<User>(API_ENDPOINTS.USERS.ME);
  return data;
}

export async function updateProfile(
  data: UpdateProfilePayload
): Promise<User> {
  const { data: body } = await api.put<User>(API_ENDPOINTS.USERS.ME, data);
  return body;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  await api.put(API_ENDPOINTS.USERS.ME_PASSWORD, {
    currentPassword,
    newPassword,
    confirmPassword,
  });
}

export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('avatar', file);
  const { data } = await api.post<User>(
    API_ENDPOINTS.USERS.ME_AVATAR,
    formData
  );
  return data;
}
