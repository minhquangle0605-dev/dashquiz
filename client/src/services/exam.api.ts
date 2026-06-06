import api from './api';
import type { PaginatedResponse, PaginationParams } from '@/types/api';
import type {
  Exam,
  ExamAttempt,
  ExamResult,
  TeacherExam,
  CreateExamPayload,
  UpdateExamPayload,
  AddExamQuestionsPayload,
  ScheduleExamPayload,
  AssignExamPayload,
  ExamAssignmentItem,
  ExamMonitoringData,
  ExamSecuritySettings,
  AttemptEvidenceData,
  ProctorReviewDecision,
  SecurityRiskLevel,
} from '@/types/exam';
import { API_ENDPOINTS } from '@/utils/constants';

/* ── Student-side APIs ──────────────────────────────── */

export interface ExamListParams extends PaginationParams {
  status?: string;
  subject?: string;
  search?: string;
}

export interface ExamAnswerPayload {
  questionId: string;
  selectedOptionId?: string;
  textAnswer?: string;
}

export async function getExams(
  params?: ExamListParams,
): Promise<PaginatedResponse<Exam>> {
  const { data } = await api.get<PaginatedResponse<Exam>>(
    API_ENDPOINTS.EXAMS.BASE,
    { params },
  );
  return data;
}

export async function getExamById(id: string): Promise<Exam> {
  const { data } = await api.get<Exam>(API_ENDPOINTS.EXAMS.BY_ID(id));
  return data;
}

export async function startExam(examId: string): Promise<ExamAttempt> {
  const { data } = await api.post<ExamAttempt>(
    API_ENDPOINTS.EXAMS.START(examId),
  );
  return data;
}

export async function saveAnswers(
  attemptId: string,
  answers: ExamAnswerPayload[],
): Promise<void> {
  await api.put(API_ENDPOINTS.EXAMS.ATTEMPT_ANSWERS(attemptId), { answers });
}

export async function submitExam(attemptId: string): Promise<ExamAttempt> {
  const { data } = await api.post<ExamAttempt>(
    API_ENDPOINTS.EXAMS.ATTEMPT_SUBMIT(attemptId),
  );
  return data;
}

export async function getExamResult(attemptId: string): Promise<ExamResult> {
  const { data } = await api.get<ExamResult>(
    API_ENDPOINTS.EXAMS.ATTEMPT_RESULT(attemptId),
  );
  return data;
}

/* ── Teacher-side APIs (Exam CRUD) ──────────────────── */

export interface TeacherExamListParams extends PaginationParams {
  status?: string;
  subjectId?: number;
  classId?: number;
  search?: string;
}

export async function listTeacherExams(
  params: TeacherExamListParams = {},
): Promise<PaginatedResponse<TeacherExam>> {
  // Backend schema accepts `limit` (not `pageSize`) and returns
  // { success, data: TeacherExam[], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }.
  // Normalize to the frontend's PaginatedResponse shape.
  const { pageSize, sortBy: _sortBy, sortOrder: _sortOrder, ...rest } = params;
  void _sortBy;
  void _sortOrder;
  const query: Record<string, unknown> = { ...rest };
  if (pageSize != null) query.limit = pageSize;

  const { data } = await api.get(API_ENDPOINTS.EXAMS.BASE, { params: query });

  const items: TeacherExam[] = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
        ? data
        : [];
  const p = data?.pagination ?? {};
  const page = Number(p.page ?? params.page ?? 1);
  const limit = Number(p.limit ?? pageSize ?? items.length);
  const total = Number(p.total ?? items.length);
  const totalPages = Number(p.totalPages ?? (limit > 0 ? Math.ceil(total / limit) : 0));

  return {
    items,
    total,
    page,
    pageSize: limit,
    totalPages,
    hasNextPage: p.hasNext ?? page < totalPages,
    hasPreviousPage: p.hasPrev ?? page > 1,
  };
}

export async function getTeacherExam(id: number): Promise<TeacherExam> {
  const { data } = await api.get(API_ENDPOINTS.EXAMS.BY_ID(id));
  return data.data ?? data;
}

export async function createExam(
  payload: CreateExamPayload,
): Promise<TeacherExam> {
  const { data } = await api.post(API_ENDPOINTS.EXAMS.BASE, payload);
  return data.data ?? data;
}

export async function updateExam(
  id: number,
  payload: UpdateExamPayload,
): Promise<TeacherExam> {
  const { data } = await api.put(API_ENDPOINTS.EXAMS.BY_ID(id), payload);
  return data.data ?? data;
}

export async function deleteExam(id: number): Promise<void> {
  await api.delete(API_ENDPOINTS.EXAMS.BY_ID(id));
}

export async function addExamQuestions(
  examId: number,
  payload: AddExamQuestionsPayload,
): Promise<void> {
  await api.post(API_ENDPOINTS.EXAMS.QUESTIONS(examId), payload);
}

export async function publishExam(id: number): Promise<TeacherExam> {
  const { data } = await api.put(API_ENDPOINTS.EXAMS.PUBLISH(id));
  return data.data ?? data;
}

export async function scheduleExam(
  id: number,
  payload: ScheduleExamPayload,
): Promise<void> {
  await api.post(API_ENDPOINTS.EXAMS.SCHEDULE(id), payload);
}

export async function assignExam(
  id: number,
  payload: AssignExamPayload,
): Promise<void> {
  await api.post(API_ENDPOINTS.EXAMS.ASSIGN(id), payload);
}

export async function getExamAssignments(
  id: number,
): Promise<ExamAssignmentItem[]> {
  const { data } = await api.get(API_ENDPOINTS.EXAMS.ASSIGNMENTS(id));
  return data.data ?? data;
}

export async function getExamMonitoring(
  id: number,
  params?: { classId?: number },
): Promise<ExamMonitoringData> {
  const { data } = await api.get(API_ENDPOINTS.EXAMS.MONITORING(id), { params });
  return data.data ?? data;
}

export async function getExamSecuritySettings(
  id: number,
): Promise<ExamSecuritySettings> {
  const { data } = await api.get(API_ENDPOINTS.EXAMS.SECURITY_SETTINGS(id));
  return data.data ?? data;
}

export async function updateExamSecuritySettings(
  id: number,
  payload: Partial<ExamSecuritySettings>,
): Promise<ExamSecuritySettings> {
  const { data } = await api.put(API_ENDPOINTS.EXAMS.SECURITY_SETTINGS(id), payload);
  return data.data ?? data;
}

export async function getAttemptEvidence(
  examId: number,
  attemptId: number,
): Promise<AttemptEvidenceData> {
  const { data } = await api.get(API_ENDPOINTS.EXAMS.EVIDENCE(examId, attemptId));
  return data.data ?? data;
}

export async function saveProctorReview(
  examId: number,
  attemptId: number,
  payload: {
    decision: ProctorReviewDecision;
    finalRiskLevel: SecurityRiskLevel;
    summary?: string | null;
  },
): Promise<void> {
  await api.put(API_ENDPOINTS.EXAMS.REVIEW(examId, attemptId), payload);
}
