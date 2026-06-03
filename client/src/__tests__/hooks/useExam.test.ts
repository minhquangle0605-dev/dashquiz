import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { server } from '../mocks/server';

vi.mock('@/services/exam.api', () => ({
  getExams: vi.fn().mockResolvedValue({
    success: true,
    data: [{ id: 1, title: 'Mathematics Exam', status: 'PUBLISHED' }],
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
  }),
  getExamById: vi.fn().mockResolvedValue({
    id: 1,
    title: 'Mathematics Exam',
    durationMin: 60,
    totalQuestions: 10,
    status: 'PUBLISHED',
  }),
  startExam: vi.fn().mockResolvedValue({ success: true }),
  submitExam: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/services/studentExam.api', () => ({
  listStudentExams: vi.fn().mockResolvedValue({
    success: true,
    data: [{ id: 1, title: 'Mathematics Exam', subject: { name: 'Mathematics' } }],
  }),
  startStudentExam: vi.fn().mockResolvedValue({
    success: true,
    data: { attemptId: 1, questions: [] },
  }),
  saveStudentAnswers: vi.fn().mockResolvedValue({ success: true }),
  submitStudentExam: vi.fn().mockResolvedValue({ success: true }),
  getAttemptResult: vi.fn().mockResolvedValue({
    success: true,
    data: { score: 8, totalQuestions: 10 },
  }),
}));

import { useExams, useExamById, examQueryKeys, studentExamKeys } from '@/hooks/useExam';

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('useExam hooks', () => {
  describe('examQueryKeys', () => {
    it('should generate correct query keys', () => {
      expect(examQueryKeys.all).toEqual(['exams']);
      expect(examQueryKeys.list()).toEqual(['exams', 'list', undefined]);
      expect(examQueryKeys.detail('1')).toEqual(['exams', 'detail', '1']);
    });
  });

  describe('studentExamKeys', () => {
    it('should generate correct student exam keys', () => {
      expect(studentExamKeys.all).toEqual(['student-exams']);
      expect(studentExamKeys.attempt(1)).toEqual(['student-exams', 'attempt', 1]);
      expect(studentExamKeys.result(5)).toEqual(['student-exams', 'result', 5]);
    });
  });

  describe('useExams', () => {
    it('should fetch exams list', async () => {
      const { result } = renderHook(() => useExams(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });

  describe('useExamById', () => {
    it('should fetch single exam details', async () => {
      const { result } = renderHook(() => useExamById('1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });

    it('should not fetch when id is undefined', () => {
      const { result } = renderHook(() => useExamById(undefined), { wrapper });

      expect(result.current.isFetching).toBe(false);
    });
  });
});
