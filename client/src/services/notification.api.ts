import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type {
  NotificationListResponse,
  NotificationListParams,
  PushSubscriptionPayload,
  Notification,
} from '@/types/notification';

export async function getNotifications(
  params: NotificationListParams = {},
): Promise<NotificationListResponse> {
  const { data } = await api.get(API_ENDPOINTS.NOTIFICATIONS.LIST, { params });
  return {
    data: data.data,
    unreadCount: data.unreadCount,
    pagination: data.pagination,
  };
}

export async function markNotificationRead(id: number): Promise<Notification> {
  const { data } = await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
  return data.data;
}

export async function markAllNotificationsRead(): Promise<{ updatedCount: number }> {
  const { data } = await api.put(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
  return data.data;
}

export async function subscribePush(
  subscription: PushSubscriptionPayload,
): Promise<{ id: number; updated: boolean }> {
  const { data } = await api.post(API_ENDPOINTS.NOTIFICATIONS.PUSH_SUBSCRIBE, subscription);
  return data.data;
}

export async function unsubscribePush(
  endpoint: string,
): Promise<{ removed: boolean }> {
  const { data } = await api.delete(API_ENDPOINTS.NOTIFICATIONS.PUSH_UNSUBSCRIBE, {
    data: { endpoint },
  });
  return data.data;
}
