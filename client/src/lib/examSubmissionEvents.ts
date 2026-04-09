import type { ExamStudentSubmittedPayload } from '@/types/socket';

type ExamSubmissionListener = (payload: ExamStudentSubmittedPayload) => void;

const listeners = new Set<ExamSubmissionListener>();

export function subscribeExamStudentSubmitted(listener: ExamSubmissionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyExamStudentSubmitted(payload: ExamStudentSubmittedPayload): void {
  listeners.forEach((fn) => {
    fn(payload);
  });
}
