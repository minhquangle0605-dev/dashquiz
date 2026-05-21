/** Payload shapes emitted by the server (see `server/src/socket/socketManager.ts`). */

export interface ExamStartedPayload {
  examId: number;
  title: string;
  subjectName: string;
  durationMin: number;
}

export interface ExamStudentSubmittedPayload {
  attemptId: number;
  studentId: number;
  studentName: string;
  totalScore: number;
  totalQuestions: number;
  correctCount: number;
  isAutoSubmitted: boolean;
  submittedAt: string | Date;
}

export interface ExamHeartbeatPayload {
  attemptId: number;
  studentId: number;
  answeredCount?: number;
  unansweredCount?: number;
  timeRemainingSec?: number;
  currentQuestionId?: number | null;
  occurredAt: string | Date;
}

export interface ExamAttemptEventPayload {
  attemptId: number;
  studentId: number;
  studentName: string;
  type: string;
  occurredAt: string | Date;
  clientElapsedSec: number | null;
  questionId: number | null;
  metadata?: unknown;
}

export interface ExamTimeWarningPayload {
  examId: number;
  minutesRemaining: number;
  message: string;
}

export interface ExamClosedPayload {
  examId: number;
  title: string;
}

export interface NotificationNewPayload {
  id: number;
  title: string;
  message: string;
  type: string;
  createdAt: string | Date;
}

export interface DashboardUpdatePayload {
  reason: string;
  entityType?: string;
  entityId?: number;
}
