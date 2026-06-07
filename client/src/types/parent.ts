import type { StudentDashboardData } from '@/services/analytics.api';

// Dual-login: a "linked child" is just the student account this parent session
// is bound to. The server always returns exactly one entry.
export interface LinkedChild {
  student: {
    id: number;
    fullName: string | null;
    avatar: string | null;
    username: string;
    status?: string;
    lastLoginAt?: string | null;
    classes?: { id: number; name: string; gradeLevel: number; subjectName: string }[];
  };
}

export interface ChildResultItem {
  id: number;
  examId: number;
  examTitle: string;
  subjectName: string;
  score: number;
  passed: boolean | null;
  submittedAt: string;
  timeSpentSec: number | null;
  isAutoSubmitted: boolean;
  totalQuestions: number;
}

export interface ChildResultsResponse {
  data: ChildResultItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export type ChildDashboardData = StudentDashboardData;
