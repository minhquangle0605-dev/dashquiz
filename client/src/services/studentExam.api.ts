import api from './api';
import type {
  StudentExamItem,
  StartExamData,
  SaveAnswersResponse,
  SubmitExamResponse,
  AttemptResultData,
  StudentAnswerValue,
  RecordAttemptEventPayload,
  StudentPrecheckPayload,
  StudentPrecheckData,
} from '@/types/exam';
import { API_ENDPOINTS } from '@/utils/constants';

interface ServerResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface StudentExamListParams {
  filter?: 'upcoming' | 'in_progress' | 'completed' | 'all';
  subjectId?: number;
  classId?: number;
  page?: number;
  limit?: number;
}

export async function listStudentExams(
  params?: StudentExamListParams,
): Promise<ServerResponse<StudentExamItem[]>> {
  const { data } = await api.get<ServerResponse<StudentExamItem[]>>(
    API_ENDPOINTS.STUDENT_EXAMS.LIST,
    { params },
  );
  return data;
}

export async function startStudentExam(
  examId: number,
  password?: string,
): Promise<ServerResponse<StartExamData>> {
  const { data } = await api.post<ServerResponse<StartExamData>>(
    API_ENDPOINTS.STUDENT_EXAMS.START(examId),
    password !== undefined ? { password } : undefined,
  );
  return data;
}

export async function runStudentExamPrecheck(
  examId: number,
  payload: StudentPrecheckPayload,
): Promise<ServerResponse<StudentPrecheckData>> {
  const { data } = await api.post<ServerResponse<StudentPrecheckData>>(
    API_ENDPOINTS.STUDENT_EXAMS.PRECHECK(examId),
    payload,
  );
  return data;
}

export async function saveStudentAnswers(
  attemptId: number,
  answers: Record<string, StudentAnswerValue>,
): Promise<ServerResponse<SaveAnswersResponse>> {
  const { data } = await api.put<ServerResponse<SaveAnswersResponse>>(
    API_ENDPOINTS.STUDENT_EXAMS.SAVE(attemptId),
    { answers },
  );
  return data;
}

export async function submitStudentExam(
  attemptId: number,
  answers?: Record<string, StudentAnswerValue>,
): Promise<ServerResponse<SubmitExamResponse>> {
  const { data } = await api.post<ServerResponse<SubmitExamResponse>>(
    API_ENDPOINTS.STUDENT_EXAMS.SUBMIT(attemptId),
    { answers },
  );
  return data;
}

export async function getAttemptResult(
  attemptId: number,
): Promise<ServerResponse<AttemptResultData>> {
  const { data } = await api.get<ServerResponse<AttemptResultData>>(
    API_ENDPOINTS.STUDENT_EXAMS.RESULT(attemptId),
  );
  return data;
}

export async function recordAttemptEvent(
  attemptId: number,
  payload: RecordAttemptEventPayload,
): Promise<void> {
  await api.post(API_ENDPOINTS.STUDENT_EXAMS.EVENT(attemptId), payload);
}

export async function recordAttemptEventsBatch(
  attemptId: number,
  events: RecordAttemptEventPayload[],
): Promise<void> {
  if (events.length === 0) return;
  await api.post(API_ENDPOINTS.STUDENT_EXAMS.EVENTS_BATCH(attemptId), { events });
}

export async function createAttemptSecuritySession(
  attemptId: number,
  payload: {
    deviceId: string;
    userAgent?: string;
    fullscreenState?: boolean;
    cameraPermission?: string | null;
    screenSize?: string | null;
  },
): Promise<void> {
  await api.post(API_ENDPOINTS.STUDENT_EXAMS.SECURITY_SESSION(attemptId), payload);
}

export async function recordSecurityHeartbeat(
  attemptId: number,
  payload: {
    deviceId?: string;
    fullscreenState?: boolean;
    focusState?: boolean;
    cameraPermission?: string | null;
    screenSize?: string | null;
    answeredCount?: number;
    unansweredCount?: number;
    timeRemainingSec?: number;
    currentQuestionId?: number | null;
  },
): Promise<void> {
  await api.post(API_ENDPOINTS.STUDENT_EXAMS.HEARTBEAT(attemptId), payload);
}
