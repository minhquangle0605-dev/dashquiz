import { useEffect, useState } from 'react';

import { CLIENT_SOCKET_EVENTS, SERVER_SOCKET_EVENTS } from '@/constants/socketEvents';
import { useSocketContext } from '@/providers/SocketProvider';
import type { ExamStudentSubmittedPayload } from '@/types/socket';

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
  totalSubmitted: number;
} {
  const { socket } = useSocketContext();
  const [submissions, setSubmissions] = useState<ExamSubmissionInfo[]>([]);

  useEffect(() => {
    setSubmissions([]);

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
    };

    socket.on(SERVER_SOCKET_EVENTS.EXAM_STUDENT_SUBMITTED, onSubmitted);

    return () => {
      socket.emit(CLIENT_SOCKET_EVENTS.LEAVE_EXAM, { examId: id });
      socket.off(SERVER_SOCKET_EVENTS.EXAM_STUDENT_SUBMITTED, onSubmitted);
    };
  }, [socket, examId]);

  return { submissions, totalSubmitted: submissions.length };
}
