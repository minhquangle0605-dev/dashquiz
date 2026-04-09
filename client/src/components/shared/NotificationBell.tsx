import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';

import { SERVER_SOCKET_EVENTS } from '@/constants/socketEvents';
import {
  NOTIFICATION_KEYS,
  useRecentNotifications,
  useMarkRead,
  useMarkAllRead,
} from '@/hooks/useNotifications';
import { useSocketContext } from '@/providers/SocketProvider';
import { useAuthStore } from '@/stores/authStore';
import type { Notification, NotificationListResponse } from '@/types/notification';
import type { NotificationNewPayload } from '@/types/socket';

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function notificationIcon(type: string) {
  switch (type) {
    case 'exam_result':
    case 'result':
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case 'exam_assigned':
    case 'assignment':
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
      );
  }
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: number) => void;
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkRead(notification.id);
    }
    if (notification.type === 'exam_result' || notification.type === 'result') {
      navigate('/parent/results');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
        !notification.isRead ? 'bg-indigo-50/50' : ''
      }`}
    >
      {notificationIcon(notification.type)}
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${!notification.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>
      {!notification.isRead && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
      )}
    </button>
  );
}

function getNotificationsPath(pathname: string): string {
  const prefix = pathname.split('/').filter(Boolean)[0];
  const known = ['student', 'teacher', 'parent', 'admin'];
  if (prefix && known.includes(prefix)) {
    return `/${prefix}/notifications`;
  }
  return '/parent/notifications';
}

const RECENT_LIST_PARAMS = { page: 1, limit: 10 } as const;

function notificationFromSocketPayload(
  payload: NotificationNewPayload,
  userId: number,
): Notification {
  const createdAt =
    typeof payload.createdAt === 'string'
      ? payload.createdAt
      : new Date(payload.createdAt).toISOString();
  return {
    id: payload.id,
    userId,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    isRead: false,
    createdAt,
  };
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { socket } = useSocketContext();

  const { data: notifData } = useRecentNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = notifData?.unreadCount ?? 0;
  const notifications = notifData?.data ?? [];
  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

  useEffect(() => {
    if (!socket) return;

    const onNotificationNew = (raw: unknown) => {
      const p = raw as NotificationNewPayload;
      if (typeof p?.id !== 'number' || typeof p?.title !== 'string') return;

      const authUser = useAuthStore.getState().user;
      const userId = authUser ? Number.parseInt(String(authUser.id), 10) || 0 : 0;
      const item = notificationFromSocketPayload(p, userId);

      const recentKey = NOTIFICATION_KEYS.list(RECENT_LIST_PARAMS);
      queryClient.setQueryData<NotificationListResponse | undefined>(recentKey, (old) => {
        if (!old) return old;
        if (old.data.some((n) => n.id === item.id)) return old;
        return {
          ...old,
          unreadCount: old.unreadCount + 1,
          data: [item, ...old.data].slice(0, RECENT_LIST_PARAMS.limit),
          pagination: {
            ...old.pagination,
            total: old.pagination.total + 1,
          },
        };
      });

      queryClient.setQueryData<NotificationListResponse | undefined>(
        NOTIFICATION_KEYS.unread(),
        (old) => {
          if (!old) return old;
          return { ...old, unreadCount: old.unreadCount + 1 };
        },
      );
    };

    socket.on(SERVER_SOCKET_EVENTS.NOTIFICATION_NEW, onNotificationNew);
    return () => {
      socket.off(SERVER_SOCKET_EVENTS.NOTIFICATION_NEW, onNotificationNew);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="min-h-[44px] rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <svg className="h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <p className="mt-3 text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={(id) => markRead.mutate(id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(getNotificationsPath(pathname));
              }}
              className="flex w-full items-center justify-center py-3 text-sm font-semibold text-indigo-600 transition-colors hover:bg-slate-50"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
