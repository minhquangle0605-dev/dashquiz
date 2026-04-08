export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const EXAM_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export type ExamStatus = (typeof EXAM_STATUS)[keyof typeof EXAM_STATUS];

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  EXAMS: '/exams',
  EXAM_DETAIL: '/exams/:examId',
  ATTEMPT: '/exams/:examId/attempt',
  RESULTS: '/results',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },
  USERS: {
    BASE: '/users',
    BY_ID: (id: string) => `/users/${id}`,
  },
  EXAMS: {
    BASE: '/exams',
    BY_ID: (id: string) => `/exams/${id}`,
    ATTEMPTS: (examId: string) => `/exams/${examId}/attempts`,
  },
  ANALYTICS: {
    OVERVIEW: '/analytics/overview',
    CLASS: (classId: string) => `/analytics/classes/${classId}`,
  },
} as const;
