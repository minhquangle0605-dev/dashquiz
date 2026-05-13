import api from './api';
import type {
  StudentExamItem,
  StartExamData,
  SaveAnswersResponse,
  SubmitExamResponse,
  AttemptResultData,
  StudentAnswerValue,
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
): Promise<ServerResponse<StartExamData>> {
  const { data } = await api.post<ServerResponse<StartExamData>>(
    API_ENDPOINTS.STUDENT_EXAMS.START(examId),
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
