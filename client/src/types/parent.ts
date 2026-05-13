import type { StudentDashboardData, StrengthItem } from '@/services/analytics.api';

export interface LinkedChild {
  id: number;
  studentId: number;
  student: {
    id: number;
    fullName: string;
    avatar: string | null;
    username: string;
  };
  relationship: string;
  linkedAt: string;
}

export interface LinkStudentRequest {
  code: string;
  relationship?: string;
}

export interface LinkStudentResponse {
  id: number;
  parentId: number;
  studentId: number;
  relationship: string;
  linkedAt: string;
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
export type ChildStrengthItem = StrengthItem;
