import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type {
  ExamAnalyticsSummary,
  ExamAnalyticsQuestion,
  ExamAnalyticsStudent,
} from '@/types/exam';

interface ServerResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const refreshParam = (refresh?: boolean) => (refresh ? { params: { refresh: 'true' } } : undefined);

export async function getExamAnalyticsSummary(
  examId: number,
  refresh?: boolean,
): Promise<ExamAnalyticsSummary> {
  const { data } = await api.get<ServerResponse<ExamAnalyticsSummary>>(
    API_ENDPOINTS.EXAMS.ANALYTICS_SUMMARY(examId),
    refreshParam(refresh),
  );
  return data.data;
}

export async function getExamAnalyticsQuestions(
  examId: number,
  refresh?: boolean,
): Promise<ExamAnalyticsQuestion[]> {
  const { data } = await api.get<ServerResponse<ExamAnalyticsQuestion[]>>(
    API_ENDPOINTS.EXAMS.ANALYTICS_QUESTIONS(examId),
    refreshParam(refresh),
  );
  return data.data;
}

export async function getExamAnalyticsStudents(
  examId: number,
): Promise<ExamAnalyticsStudent[]> {
  const { data } = await api.get<ServerResponse<ExamAnalyticsStudent[]>>(
    API_ENDPOINTS.EXAMS.ANALYTICS_STUDENTS(examId),
  );
  return data.data;
}

export async function recalculateExamAnalytics(
  examId: number,
): Promise<{ status: string; generatedAt: string }> {
  const { data } = await api.post<ServerResponse<{ status: string; generatedAt: string }>>(
    API_ENDPOINTS.EXAMS.ANALYTICS_RECALCULATE(examId),
  );
  return data.data;
}
