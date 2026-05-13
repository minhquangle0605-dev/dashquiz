import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';

// ═══════════════════════════════════════════════════
// STUDENT ANALYTICS
// ═══════════════════════════════════════════════════

export interface StudentDashboardData {
  totalExams: number;
  avgScore: number;
  maxScore: number;
  minScore: number;
  recentResults: {
    id: number;
    examId: number;
    examTitle: string;
    subjectName: string;
    score: number;
    submittedAt: string;
    timeSpentSec: number | null;
  }[];
  trends: Record<string, { avgScore: number; examCount: number }>;
}

export interface StrengthItem {
  topicId: number;
  topicName: string;
  chapterName: string;
  subjectName: string;
  accuracy: number;
  correctCount: number;
  totalQuestions: number;
}

export interface TimeAnalysisData {
  overallAvgTimeSec: number;
  totalAnswers: number;
  perTopic: {
    topicId: number;
    topicName: string;
    avgTimeSec: number;
    avgCorrectTimeSec: number;
    avgWrongTimeSec: number;
    totalAnswers: number;
  }[];
}

export interface KnowledgeGraphNode {
  id: number;
  name: string;
  chapterName: string;
  subjectId: number;
  subjectName: string;
  mastery: number;
  masteryLevel: 'weak' | 'developing' | 'strong';
  color: 'red' | 'yellow' | 'green';
}

export interface KnowledgeGraphEdge {
  id: number;
  source: number;
  target: number;
  relationType: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export interface AttemptItem {
  id: number;
  examId: number;
  examTitle: string;
  subjectId: number;
  subjectName: string;
  totalQuestions: number;
  durationMin: number;
  passingScore: number | null;
  score: number;
  passed: boolean | null;
  submittedAt: string;
  timeSpentSec: number | null;
  isAutoSubmitted: boolean;
  status: string;
}

export interface PaginatedAttempts {
  data: AttemptItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function getStudentDashboard(subjectId?: number): Promise<StudentDashboardData> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.STUDENT_ANALYTICS.DASHBOARD, { params });
  return data.data;
}

export async function getStudentStrengths(subjectId?: number): Promise<StrengthItem[]> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.STUDENT_ANALYTICS.STRENGTHS, { params });
  return data.data;
}

export async function getStudentTimeAnalysis(subjectId?: number): Promise<TimeAnalysisData> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.STUDENT_ANALYTICS.TIME, { params });
  return data.data;
}

export async function getStudentKnowledgeGraph(subjectId?: number): Promise<KnowledgeGraphData> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.STUDENT_ANALYTICS.KNOWLEDGE_GRAPH, { params });
  return data.data;
}

export async function getStudentAttempts(params: {
  page?: number;
  limit?: number;
  subjectId?: number;
  sort?: string;
  order?: string;
}): Promise<PaginatedAttempts> {
  const { data } = await api.get(API_ENDPOINTS.STUDENT_ANALYTICS.ATTEMPTS, { params });
  return { data: data.data, pagination: data.pagination };
}

// ═══════════════════════════════════════════════════
// TEACHER ANALYTICS
// ═══════════════════════════════════════════════════

export interface ClassDashboardData {
  class: { id: number; name: string; gradeLevel: number; subjectName: string };
  enrolledCount: number;
  examCount: number;
  avgScore: number;
  passRate: number;
  totalAttempts: number;
}

export interface ClassPerformanceItem {
  examId: number;
  examTitle: string;
  date: string;
  avgScore: number;
  attemptCount: number;
  studentCount: number;
}

export interface ExamDistributionData {
  exam: { id: number; title: string };
  totalAttempts: number;
  avgScore: number;
  medianScore: number;
  bins: { label: string; count: number }[];
}

export interface WeakStudentItem {
  student: { id: number; fullName: string; username: string };
  avgScore: number;
  recentScores: { score: number; examTitle: string; submittedAt: string }[];
}

export interface ExamResultItem {
  attemptId: number;
  studentId: number;
  studentName: string;
  studentUsername: string;
  score: number;
  passed: boolean | null;
  timeSpentSec: number | null;
  isAutoSubmitted: boolean;
  submittedAt: string;
  answeredQuestions: number;
}

export interface ExamResultsData {
  exam: { id: number; title: string; totalQuestions: number; passingScore: number | null };
  results: ExamResultItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ExportReportData {
  filename: string;
  format: string;
  size: number;
  downloadUrl: string;
  expiresIn: string;
}

export async function getClassDashboard(classId: number): Promise<ClassDashboardData> {
  const { data } = await api.get(API_ENDPOINTS.TEACHER_ANALYTICS.CLASS_DASHBOARD(classId));
  return data.data;
}

export async function getClassPerformance(classId: number, limit = 10): Promise<ClassPerformanceItem[]> {
  const { data } = await api.get(API_ENDPOINTS.TEACHER_ANALYTICS.CLASS_PERFORMANCE(classId), { params: { limit } });
  return data.data;
}

export async function getExamDistribution(examId: number): Promise<ExamDistributionData> {
  const { data } = await api.get(API_ENDPOINTS.TEACHER_ANALYTICS.EXAM_DISTRIBUTION(examId));
  return data.data;
}

export async function getWeakStudents(classId: number, threshold = 5, consecutiveExams = 3): Promise<WeakStudentItem[]> {
  const { data } = await api.get(API_ENDPOINTS.TEACHER_ANALYTICS.WEAK_STUDENTS(classId), {
    params: { threshold, consecutiveExams },
  });
  return data.data;
}

export async function getExamResults(
  examId: number,
  params: { page?: number; limit?: number; sort?: string; order?: string },
): Promise<ExamResultsData> {
  const { data } = await api.get(API_ENDPOINTS.TEACHER_ANALYTICS.EXAM_RESULTS(examId), { params });
  return data.data;
}

export async function exportReport(body: {
  format: 'pdf' | 'excel';
  reportType: string;
  classId?: number;
  examId?: number;
  title?: string;
}): Promise<ExportReportData> {
  const { data } = await api.post(API_ENDPOINTS.TEACHER_ANALYTICS.EXPORT_REPORT, body);
  return data.data;
}

export async function getTeacherClasses(): Promise<{ id: number; name: string; gradeLevel: number; subjectName?: string }[]> {
  const { data } = await api.get(API_ENDPOINTS.CLASSES.BASE);
  const items = data.data?.items ?? data.data ?? data.items ?? [];
  return Array.isArray(items) ? items : [];
}

export async function getTeacherExams(): Promise<{ id: number; title: string; subjectId?: number; status?: string }[]> {
  const { data } = await api.get(API_ENDPOINTS.EXAMS.BASE, { params: { page: 1, pageSize: 100 } });
  const items = data.data?.items ?? data.data ?? data.items ?? [];
  return Array.isArray(items) ? items : [];
}
