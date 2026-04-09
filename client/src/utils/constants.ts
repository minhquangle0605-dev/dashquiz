export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.TEACHER]: '/teacher/dashboard',
  [ROLES.STUDENT]: '/student/dashboard',
  [ROLES.PARENT]: '/parent/dashboard',
};

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
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  FORBIDDEN: '/403',
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    ME: '/api/auth/me',
  },
  USERS: {
    BASE: '/api/users',
    BY_ID: (id: string) => `/api/users/${id}`,
    ME: '/api/users/me',
    ME_PASSWORD: '/api/users/me/password',
    ME_AVATAR: '/api/users/me/avatar',
  },
  EXAMS: {
    BASE: '/api/exams',
    BY_ID: (id: string) => `/api/exams/${id}`,
    ATTEMPTS: (examId: string) => `/api/exams/${examId}/attempts`,
    START: (examId: string) => `/api/exams/${examId}/start`,
    ATTEMPT_ANSWERS: (attemptId: string) =>
      `/api/exams/attempts/${attemptId}/answers`,
    ATTEMPT_SUBMIT: (attemptId: string) =>
      `/api/exams/attempts/${attemptId}/submit`,
    ATTEMPT_RESULT: (attemptId: string) =>
      `/api/exams/attempts/${attemptId}/result`,
  },
  ANALYTICS: {
    OVERVIEW: '/api/analytics/overview',
    CLASS: (classId: string) => `/api/analytics/classes/${classId}`,
  },
} as const;
