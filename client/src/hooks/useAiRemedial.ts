import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  generateRemedialPractice,
  getRemedialSession,
  submitRemedialAnswer,
  type GenerateRemedialResponse,
  type RemedialSession,
  type SubmitRemedialAnswerResponse,
} from '@/services/ai.api';

export const aiRemedialKeys = {
  all: ['ai-remedial'] as const,
  session: (sessionId: number) => [...aiRemedialKeys.all, 'session', sessionId] as const,
};

export function useGenerateRemedial() {
  return useMutation<GenerateRemedialResponse, Error, number>({
    mutationFn: (attemptId) => generateRemedialPractice(attemptId),
  });
}

export function useRemedialSession(sessionId: number | undefined) {
  return useQuery<RemedialSession>({
    queryKey: aiRemedialKeys.session(sessionId ?? 0),
    queryFn: () => getRemedialSession(sessionId!),
    enabled: Boolean(sessionId),
    staleTime: 30_000,
  });
}

export function useSubmitRemedialAnswer(sessionId: number) {
  const qc = useQueryClient();
  return useMutation<
    SubmitRemedialAnswerResponse,
    Error,
    { questionId: number; selectedLabel: string }
  >({
    mutationFn: ({ questionId, selectedLabel }) =>
      submitRemedialAnswer(sessionId, questionId, selectedLabel),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: aiRemedialKeys.session(sessionId) });
    },
  });
}
