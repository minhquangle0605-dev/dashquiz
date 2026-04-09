import api from './api';
import type { PaginatedResponse, PaginationParams } from '@/types/api';
import type { Exam, ExamAttempt, ExamResult } from '@/types/exam';
import { API_ENDPOINTS } from '@/utils/constants';

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
  params?: ExamListParams
): Promise<PaginatedResponse<Exam>> {
  const { data } = await api.get<PaginatedResponse<Exam>>(
    API_ENDPOINTS.EXAMS.BASE,
    { params }
  );
  return data;
}

export async function getExamById(id: string): Promise<Exam> {
  const { data } = await api.get<Exam>(API_ENDPOINTS.EXAMS.BY_ID(id));
  return data;
}

export async function startExam(examId: string): Promise<ExamAttempt> {
  const { data } = await api.post<ExamAttempt>(
    API_ENDPOINTS.EXAMS.START(examId)
  );
  return data;
}

export async function saveAnswers(
  attemptId: string,
  answers: ExamAnswerPayload[]
): Promise<void> {
  await api.put(API_ENDPOINTS.EXAMS.ATTEMPT_ANSWERS(attemptId), { answers });
}

export async function submitExam(attemptId: string): Promise<ExamAttempt> {
  const { data } = await api.post<ExamAttempt>(
    API_ENDPOINTS.EXAMS.ATTEMPT_SUBMIT(attemptId)
  );
  return data;
}

export async function getExamResult(attemptId: string): Promise<ExamResult> {
  const { data } = await api.get<ExamResult>(
    API_ENDPOINTS.EXAMS.ATTEMPT_RESULT(attemptId)
  );
  return data;
}
