import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';

interface ServerResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AdminOverview {
  examCount: number;
  classCount: number;
  studentCount: number;
  totalAttempts: number;
  avgScore: number;
  passRate: number;
  flaggedQuestions: number;
}

export interface AdminClassRow {
  classId: number;
  className: string;
  gradeLevel: number;
  subjectName: string;
  teacherName: string | null;
  studentCount: number;
  attemptCount: number;
  avgScore: number;
  passRate: number;
}

export interface AdminSubjectRow {
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  examCount: number;
  attemptCount: number;
  avgScore: number;
  passRate: number;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const { data } = await api.get<ServerResponse<AdminOverview>>(API_ENDPOINTS.ADMIN.ANALYTICS.OVERVIEW);
  return data.data;
}

export async function getAdminClasses(): Promise<AdminClassRow[]> {
  const { data } = await api.get<ServerResponse<AdminClassRow[]>>(API_ENDPOINTS.ADMIN.ANALYTICS.CLASSES);
  return data.data;
}

export async function getAdminSubjects(): Promise<AdminSubjectRow[]> {
  const { data } = await api.get<ServerResponse<AdminSubjectRow[]>>(API_ENDPOINTS.ADMIN.ANALYTICS.SUBJECTS);
  return data.data;
}
