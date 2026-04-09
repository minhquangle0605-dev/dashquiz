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
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  SCHEDULED: 'SCHEDULED',
  CLOSED: 'CLOSED',
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
  ADMIN: {
    USERS: {
      BASE: '/api/admin/users',
      BY_ID: (id: number) => `/api/admin/users/${id}`,
      ROLE: (id: number) => `/api/admin/users/${id}/role`,
      IMPORT: '/api/admin/users/import',
      IMPORT_TEMPLATE: '/api/admin/users/import-template',
    },
    ACADEMIC: {
      SUBJECTS: '/api/admin/academic/subjects',
      SUBJECT_BY_ID: (id: number) => `/api/admin/academic/subjects/${id}`,
      ACADEMIC_YEARS: '/api/admin/academic/academic-years',
      ACADEMIC_YEAR_BY_ID: (id: number) => `/api/admin/academic/academic-years/${id}`,
      SEMESTERS: '/api/admin/academic/semesters',
      SEMESTER_BY_ID: (id: number) => `/api/admin/academic/semesters/${id}`,
    },
    SYSTEM: {
      CONFIGS: '/api/admin/system/configs',
      MONITORING: '/api/admin/system/monitoring',
      ACTIVITY_LOGS: '/api/admin/system/activity-logs',
      BACKUPS: '/api/admin/system/backups',
      BACKUP_RESTORE: (id: number) => `/api/admin/system/backups/${id}/restore`,
    },
  },
  STUDENT_EXAMS: {
    LIST: '/api/student/exams',
    START: (examId: number) => `/api/student/exams/${examId}/start`,
    SAVE: (attemptId: number) => `/api/student/attempts/${attemptId}/save`,
    SUBMIT: (attemptId: number) => `/api/student/attempts/${attemptId}/submit`,
    RESULT: (attemptId: number) => `/api/student/attempts/${attemptId}/result`,
    ATTEMPTS: '/api/student/attempts',
  },
  EXAMS: {
    BASE: '/api/exams',
    BY_ID: (id: string | number) => `/api/exams/${id}`,
    ATTEMPTS: (examId: string) => `/api/exams/${examId}/attempts`,
    START: (examId: string) => `/api/exams/${examId}/start`,
    ATTEMPT_ANSWERS: (attemptId: string) =>
      `/api/exams/attempts/${attemptId}/answers`,
    ATTEMPT_SUBMIT: (attemptId: string) =>
      `/api/exams/attempts/${attemptId}/submit`,
    ATTEMPT_RESULT: (attemptId: string) =>
      `/api/exams/attempts/${attemptId}/result`,
    QUESTIONS: (id: number) => `/api/exams/${id}/questions`,
    PUBLISH: (id: number) => `/api/exams/${id}/publish`,
    SCHEDULE: (id: number) => `/api/exams/${id}/schedule`,
    ASSIGN: (id: number) => `/api/exams/${id}/assign`,
    ASSIGNMENTS: (id: number) => `/api/exams/${id}/assignments`,
  },
  CLASSES: {
    BASE: '/api/classes',
    BY_ID: (id: number) => `/api/classes/${id}`,
    STUDENTS: (id: number) => `/api/classes/${id}/students`,
    REMOVE_STUDENT: (classId: number, studentId: number) =>
      `/api/classes/${classId}/students/${studentId}`,
    IMPORT_STUDENTS: (id: number) => `/api/classes/${id}/students/import`,
    IMPORT_TEMPLATE: '/api/classes/import-template',
  },
  ANALYTICS: {
    OVERVIEW: '/api/analytics/overview',
    CLASS: (classId: string) => `/api/analytics/classes/${classId}`,
  },
  QUESTIONS: {
    BASE: '/api/questions',
    BY_ID: (id: number) => `/api/questions/${id}`,
    IMPORT: '/api/questions/import',
    IMPORT_TEMPLATE: '/api/questions/import-template',
    TAGS: (id: number) => `/api/questions/${id}/tags`,
    TAG_BY_ID: (questionId: number, tagId: number) =>
      `/api/questions/${questionId}/tags/${tagId}`,
  },
  CURRICULUM: {
    SUBJECTS: '/api/subjects',
    CHAPTERS_BY_SUBJECT: (subjectId: number) =>
      `/api/subjects/${subjectId}/chapters`,
    TOPICS_BY_CHAPTER: (chapterId: number) =>
      `/api/chapters/${chapterId}/topics`,
  },
} as const;
