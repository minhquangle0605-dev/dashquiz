import type { ExamStatus } from '@/utils/constants';

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
  /** Present when revealing correct answers (e.g. teacher review). */
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  examId: string;
  order: number;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  prompt: string;
  points: number;
  options?: QuestionOption[];
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  subject: string;
  gradeLevel: string;
  status: ExamStatus;
  durationMinutes: number;
  totalPoints: number;
  questionCount: number;
  availableFrom: string;
  availableUntil: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  userId: string;
  startedAt: string;
  submittedAt: string | null;
  timeRemainingSeconds: number | null;
  status: 'in_progress' | 'submitted' | 'graded' | 'expired';
}

export interface ExamResult {
  attemptId: string;
  examId: string;
  userId: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  gradedAt: string;
  breakdown?: Array<{
    questionId: string;
    awardedPoints: number;
    maxPoints: number;
    feedback?: string;
  }>;
}
