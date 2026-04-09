import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

import { syncTokensFromRefresh, useAuthStore } from '@/stores/authStore';
import { API_ENDPOINTS } from '@/utils/constants';

const baseURL = '/api';

export const rawApi = axios.create({ baseURL: '' });

const api = axios.create({ baseURL: '' });

interface RefreshResponseBody {
  accessToken: string;
  refreshToken?: string;
}

let refreshPromise: Promise<string | null> | null = null;

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    useAuthStore.getState().logout();
    return null;
  }

  try {
    const { data } = await rawApi.post<RefreshResponseBody>(
      API_ENDPOINTS.AUTH.REFRESH,
      { refreshToken }
    );

    const nextRefresh = data.refreshToken ?? refreshToken;
    syncTokensFromRefresh({
      accessToken: data.accessToken,
      refreshToken: nextRefresh,
    });
    return data.accessToken;
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
