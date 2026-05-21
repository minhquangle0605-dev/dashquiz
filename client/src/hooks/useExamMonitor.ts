import { useEffect, useState } from 'react';

import { CLIENT_SOCKET_EVENTS, SERVER_SOCKET_EVENTS } from '@/constants/socketEvents';
import { useSocketContext } from '@/providers/SocketProvider';
import type {
  ExamAttemptEventPayload,
  ExamHeartbeatPayload,
  ExamStudentSubmittedPayload,
} from '@/types/socket';

export interface ExamSubmissionInfo {
  attemptId: number;
  studentId: number;
  studentName: string;
  totalScore: number;
  totalQuestions: number;
  correctCount: number;
  isAutoSubmitted: boolean;
  submittedAt: string;
}

export interface ExamHeartbeatInfo {
  attemptId: number;
  studentId: number;
  answeredCount?: number;
  unansweredCount?: number;
  timeRemainingSec?: number;
  currentQuestionId?: number | null;
  occurredAt: string;
}

export interface ExamAttemptEventInfo {
  attemptId: number;
  studentId: number;
  studentName: string;
  type: string;
  occurredAt: string;
  clientElapsedSec: number | null;
  questionId: number | null;
  metadata?: unknown;
}

function normalizePayload(raw: ExamStudentSubmittedPayload): ExamSubmissionInfo {
  const submittedAt =
    typeof raw.submittedAt === 'string'
      ? raw.submittedAt
      : new Date(raw.submittedAt).toISOString();
  return {
    attemptId: raw.attemptId,
    studentId: raw.studentId,
    studentName: raw.studentName,
    totalScore: raw.totalScore,
    totalQuestions: raw.totalQuestions,
    correctCount: raw.correctCount,
    isAutoSubmitted: raw.isAutoSubmitted,
    submittedAt,
  };
}

export function useExamMonitor(examId: number | null | undefined): {
  submissions: ExamSubmissionInfo[];
  heartbeats: ExamHeartbeatInfo[];
  events: ExamAttemptEventInfo[];
  liveVersion: number;
  totalSubmitted: number;
} {
  const { socket } = useSocketContext();
  const [submissions, setSubmissions] = useState<ExamSubmissionInfo[]>([]);
  const [heartbeats, setHeartbeats] = useState<ExamHeartbeatInfo[]>([]);
  const [events, setEvents] = useState<ExamAttemptEventInfo[]>([]);
  const [liveVersion, setLiveVersion] = useState(0);

  useEffect(() => {
    setSubmissions([]);
    setHeartbeats([]);
    setEvents([]);
    setLiveVersion(0);

    if (!socket || examId == null || Number.isNaN(examId)) {
      return;
    }

    const id = examId;
    socket.emit(CLIENT_SOCKET_EVENTS.JOIN_EXAM, { examId: id });

    const onSubmitted = (raw: unknown) => {
      const p = raw as ExamStudentSubmittedPayload;
      if (typeof p?.attemptId !== 'number') return;
      const row = normalizePayload(p);
      setSubmissions((prev) => {
        if (prev.some((x) => x.attemptId === row.attemptId)) return prev;
        return [...prev, row];
      });
      setLiveVersion((v) => v + 1);
    };

    const onHeartbeat = (raw: unknown) => {
      const p = raw as ExamHeartbeatPayload;
      if (typeof p?.attemptId !== 'number') return;
      const occurredAt =
        typeof p.occurredAt === 'string'
          ? p.occurredAt
          : new Date(p.occurredAt).toISOString();
      setHeartbeats((prev) => [
        {
          attemptId: p.attemptId,
          studentId: p.studentId,
          answeredCount: p.answeredCount,
          unansweredCount: p.unansweredCount,
          timeRemainingSec: p.timeRemainingSec,
          currentQuestionId: p.currentQuestionId,
          occurredAt,
        },
        ...prev.slice(0, 49),
      ]);
      setLiveVersion((v) => v + 1);
    };

    const onAttemptEvent = (raw: unknown) => {
      const p = raw as ExamAttemptEventPayload;
      if (typeof p?.attemptId !== 'number' || typeof p.type !== 'string') return;
      const occurredAt =
        typeof p.occurredAt === 'string'
          ? p.occurredAt
          : new Date(p.occurredAt).toISOString();
      setEvents((prev) => [
        {
          attemptId: p.attemptId,
          studentId: p.studentId,
          studentName: p.studentName,
          type: p.type,
          occurredAt,
          clientElapsedSec: p.clientElapsedSec,
          questionId: p.questionId,
          metadata: p.metadata,
        },
        ...prev.slice(0, 99),
      ]);
      setLiveVersion((v) => v + 1);
    };

    socket.on(SERVER_SOCKET_EVENTS.EXAM_STUDENT_SUBMITTED, onSubmitted);
    socket.on(SERVER_SOCKET_EVENTS.EXAM_HEARTBEAT, onHeartbeat);
    socket.on(SERVER_SOCKET_EVENTS.EXAM_ATTEMPT_EVENT, onAttemptEvent);

    return () => {
      socket.emit(CLIENT_SOCKET_EVENTS.LEAVE_EXAM, { examId: id });
      socket.off(SERVER_SOCKET_EVENTS.EXAM_STUDENT_SUBMITTED, onSubmitted);
      socket.off(SERVER_SOCKET_EVENTS.EXAM_HEARTBEAT, onHeartbeat);
      socket.off(SERVER_SOCKET_EVENTS.EXAM_ATTEMPT_EVENT, onAttemptEvent);
    };
  }, [socket, examId]);

  return { submissions, heartbeats, events, liveVersion, totalSubmitted: submissions.length };
}
