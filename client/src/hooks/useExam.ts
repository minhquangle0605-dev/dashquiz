import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';

import type { PaginatedResponse } from '@/types/api';
import type { Exam } from '@/types/exam';
import {
  type ExamListParams,
  getExamById,
  getExams,
  submitExam,
  startExam,
} from '@/services/exam.api';

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
