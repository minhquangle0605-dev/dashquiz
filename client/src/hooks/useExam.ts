import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';

import type { PaginatedResponse } from '@/types/api';
import type {
  AttemptResultData,
  Exam,
  StartExamData,
  StudentAnswerValue,
  StudentExamItem,
} from '@/types/exam';
import {
  type ExamListParams,
  getExamById,
  getExams,
  submitExam,
  startExam,
} from '@/services/exam.api';
import {
  listStudentExams,
  startStudentExam,
  saveStudentAnswers,
  submitStudentExam,
  getAttemptResult,
  type StudentExamListParams,
} from '@/services/studentExam.api';

/* ── Teacher-side query keys ──────────────────────── */

export const examQueryKeys = {
  all: ['exams'] as const,
  list: (params?: ExamListParams) => [...examQueryKeys.all, 'list', params] as const,
  detail: (id: string) => [...examQueryKeys.all, 'detail', id] as const,
};

export function useExams(
  params?: ExamListParams,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<Exam>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: examQueryKeys.list(params),
    queryFn: () => getExams(params),
    ...options,
  });
}

export function useExamById(
  id: string | undefined,
  options?: Omit<UseQueryOptions<Exam>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: examQueryKeys.detail(id ?? ''),
    queryFn: () => getExamById(id!),
    enabled: Boolean(id),
    ...options,
  });
}

export function useStartExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => startExam(examId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: examQueryKeys.all });
    },
  });
}

export function useSubmitExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attemptId: string) => submitExam(attemptId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: examQueryKeys.all });
    },
  });
}

/* ── Student-side query keys & hooks ──────────────── */

export const studentExamKeys = {
  all: ['student-exams'] as const,
  list: (params?: StudentExamListParams) =>
    [...studentExamKeys.all, 'list', params] as const,
  attempt: (examId: number) =>
    [...studentExamKeys.all, 'attempt', examId] as const,
  result: (attemptId: number) =>
    [...studentExamKeys.all, 'result', attemptId] as const,
};

interface StudentExamsResponse {
  success: boolean;
  data: StudentExamItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function useStudentExams(params?: StudentExamListParams) {
  return useQuery<StudentExamsResponse>({
    queryKey: studentExamKeys.list(params),
    queryFn: () => listStudentExams(params),
  });
}

interface StartExamResponse {
  success: boolean;
  data: StartExamData;
}

export interface StartStudentExamVars {
  examId: number;
  password?: string;
}

export function useStartStudentExam() {
  const qc = useQueryClient();
  return useMutation<StartExamResponse, Error, StartStudentExamVars>({
    mutationFn: ({ examId, password }) => startStudentExam(examId, password),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: studentExamKeys.all });
    },
  });
}

export function useSaveAnswers() {
  return useMutation({
    mutationFn: ({
      attemptId,
      answers,
    }: {
      attemptId: number;
      answers: Record<string, StudentAnswerValue>;
    }) => saveStudentAnswers(attemptId, answers),
  });
}

export function useSubmitStudentExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      attemptId,
      answers,
    }: {
      attemptId: number;
      answers?: Record<string, StudentAnswerValue>;
    }) => submitStudentExam(attemptId, answers),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: studentExamKeys.all });
    },
  });
}

interface AttemptResultResponse {
  success: boolean;
  data: AttemptResultData;
}

export function useAttemptResult(attemptId: number | undefined) {
  return useQuery<AttemptResultResponse>({
    queryKey: studentExamKeys.result(attemptId ?? 0),
    queryFn: () => getAttemptResult(attemptId!),
    enabled: Boolean(attemptId),
  });
}
