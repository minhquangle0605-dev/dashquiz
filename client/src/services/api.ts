import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

import { syncTokensFromRefresh, useAuthStore } from '@/stores/authStore';
import { API_ENDPOINTS } from '@/utils/constants';

export const rawApi = axios.create({ baseURL: '', withCredentials: true });

const api = axios.create({ baseURL: '', withCredentials: true });

let refreshPromise: Promise<string | null> | null = null;

async function performTokenRefresh(): Promise<string | null> {
  try {
    const { data } = await rawApi.post<{ data: { accessToken: string } }>(
      API_ENDPOINTS.AUTH.REFRESH,
    );

    const accessToken = data.data.accessToken;
    syncTokensFromRefresh({ accessToken });
    return accessToken;
  } catch {
    useAuthStore.getState().logout();
    return null;
  }
}

function queueRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status !== 401 ||
      original === undefined ||
      original._retry === true
    ) {
      return Promise.reject(error);
    }

    const url = original.url ?? '';
    if (url.includes(API_ENDPOINTS.AUTH.REFRESH)) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    original._retry = true;
    const newAccess = await queueRefresh();
    if (newAccess === null) {
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${newAccess}`;
    return api.request(original);
  }
);

export default api;
