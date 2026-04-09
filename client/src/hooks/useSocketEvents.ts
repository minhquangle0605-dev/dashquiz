import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Socket } from 'socket.io-client';

import { SERVER_SOCKET_EVENTS } from '@/constants/socketEvents';
import { NOTIFICATION_KEYS } from '@/hooks/useNotifications';
import { notifyExamStudentSubmitted } from '@/lib/examSubmissionEvents';
import type {
  ExamClosedPayload,
  ExamStartedPayload,
  ExamStudentSubmittedPayload,
  ExamTimeWarningPayload,
  NotificationNewPayload,
} from '@/types/socket';

export function useSocketEvents(socket: Socket | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const onNotificationNew = (raw: unknown) => {
      const p = raw as NotificationNewPayload;
      if (typeof p?.title !== 'string') return;
      toast(p.title);
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
    };

    const onExamStarted = (raw: unknown) => {
      const p = raw as ExamStartedPayload;
      if (typeof p?.title !== 'string') return;
      toast(`New exam available: ${p.title}`);
    };

    const onExamStudentSubmitted = (raw: unknown) => {
      const p = raw as ExamStudentSubmittedPayload;
      if (typeof p?.attemptId !== 'number') return;
      notifyExamStudentSubmitted(p);
    };

    const onExamTimeWarning = (raw: unknown) => {
      const p = raw as ExamTimeWarningPayload;
      const mins = p?.minutesRemaining;
      if (typeof mins !== 'number') return;
      const text =
        typeof p.message === 'string' && p.message.length > 0
          ? p.message
          : `${mins} minute${mins === 1 ? '' : 's'} remaining`;
      toast(text, {
        duration: 6000,
        icon: '⚠️',
        style: { border: '1px solid #f59e0b' },
      });
    };

    const onExamClosed = (raw: unknown) => {
      const p = raw as ExamClosedPayload;
      if (typeof p?.title !== 'string') return;
      toast(`Exam closed: ${p.title}`);
    };

    const onDashboardUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['parent', 'children'] });
    };

    socket.on(SERVER_SOCKET_EVENTS.NOTIFICATION_NEW, onNotificationNew);
    socket.on(SERVER_SOCKET_EVENTS.EXAM_STARTED, onExamStarted);
    socket.on(SERVER_SOCKET_EVENTS.EXAM_STUDENT_SUBMITTED, onExamStudentSubmitted);
    socket.on(SERVER_SOCKET_EVENTS.EXAM_TIME_WARNING, onExamTimeWarning);
    socket.on(SERVER_SOCKET_EVENTS.EXAM_CLOSED, onExamClosed);
    socket.on(SERVER_SOCKET_EVENTS.DASHBOARD_UPDATE, onDashboardUpdate);

    return () => {
      socket.off(SERVER_SOCKET_EVENTS.NOTIFICATION_NEW, onNotificationNew);
      socket.off(SERVER_SOCKET_EVENTS.EXAM_STARTED, onExamStarted);
      socket.off(SERVER_SOCKET_EVENTS.EXAM_STUDENT_SUBMITTED, onExamStudentSubmitted);
      socket.off(SERVER_SOCKET_EVENTS.EXAM_TIME_WARNING, onExamTimeWarning);
      socket.off(SERVER_SOCKET_EVENTS.EXAM_CLOSED, onExamClosed);
      socket.off(SERVER_SOCKET_EVENTS.DASHBOARD_UPDATE, onDashboardUpdate);
    };
  }, [socket, queryClient]);
}
