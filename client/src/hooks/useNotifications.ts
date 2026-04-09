import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/notification.api';
import type { NotificationListParams } from '@/types/notification';

export const NOTIFICATION_KEYS = {
  all: ['notifications'] as const,
  list: (params: NotificationListParams) => ['notifications', 'list', params] as const,
  unread: () => ['notifications', 'unread'] as const,
};

export function useNotificationList(params: NotificationListParams = {}) {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.list(params),
    queryFn: () => getNotifications(params),
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.unread(),
    queryFn: () => getNotifications({ page: 1, limit: 1 }),
    select: (data) => data.unreadCount,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useRecentNotifications() {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.list({ page: 1, limit: 10 }),
    queryFn: () => getNotifications({ page: 1, limit: 10 }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
    },
  });
}
