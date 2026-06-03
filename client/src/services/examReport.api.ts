import api from './api';
import type { ExamReportData } from '@/types/exam';
import { API_ENDPOINTS } from '@/utils/constants';

interface ServerResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getExamReport(examId: number): Promise<ExamReportData> {
  const { data } = await api.get<ServerResponse<ExamReportData>>(
    API_ENDPOINTS.EXAMS.REPORTS(examId),
  );
  return data.data;
}

export async function gradeExamAnswer(
  examId: number,
  attemptId: number,
  answerId: number,
  payload: { score: number; feedback?: string | null },
): Promise<{ answerId: number; attemptId: number; score: number; totalScore: number }> {
  const { data } = await api.put<
    ServerResponse<{ answerId: number; attemptId: number; score: number; totalScore: number }>
  >(API_ENDPOINTS.EXAMS.GRADE_ANSWER(examId, attemptId, answerId), payload);
  return data.data;
}

export async function deleteExamAttempt(examId: number, attemptId: number): Promise<void> {
  await api.delete(API_ENDPOINTS.EXAMS.DELETE_ATTEMPT(examId, attemptId));
}
