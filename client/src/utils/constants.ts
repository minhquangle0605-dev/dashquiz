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
  FORBIDDEN: '/403',
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
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
      ROLES: '/api/admin/users/roles',
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
    EVENT: (attemptId: number) => `/api/student/attempts/${attemptId}/events`,
    ATTEMPTS: '/api/student/attempts',
  },
  AI: {
    REMEDIAL_GENERATE: '/api/ai/remedial-practice',
    REMEDIAL_SESSION: (sessionId: number) => `/api/ai/remedial-sessions/${sessionId}`,
    REMEDIAL_ANSWER: (sessionId: number, questionId: number) =>
      `/api/ai/remedial-sessions/${sessionId}/questions/${questionId}/answer`,
    MATCHING_DISTRACTOR: '/api/ai/matching-distractor',
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
    MONITORING: (id: number) => `/api/exams/${id}/monitoring`,
    REPORTS: (id: number) => `/api/exams/${id}/reports`,
    GRADE_ANSWER: (id: number, attemptId: number, answerId: number) =>
      `/api/exams/${id}/attempts/${attemptId}/answers/${answerId}/grade`,
    DELETE_ATTEMPT: (id: number, attemptId: number) =>
      `/api/exams/${id}/attempts/${attemptId}`,
  },
  CLASSES: {
    BASE: '/api/classes',
    MY: '/api/classes/my',
    BY_ID: (id: number) => `/api/classes/${id}`,
    COURSE: (id: number) => `/api/classes/${id}/course`,
    SECTIONS: (id: number) => `/api/classes/${id}/sections`,
    SECTION_BY_ID: (classId: number, sectionId: number) =>
      `/api/classes/${classId}/sections/${sectionId}`,
    RESOURCES: (id: number) => `/api/classes/${id}/resources`,
    RESOURCE_BY_ID: (classId: number, resourceId: number) =>
      `/api/classes/${classId}/resources/${resourceId}`,
    RESOURCE_UPLOAD: (id: number) => `/api/classes/${id}/resources/upload`,
    RESOURCE_DOWNLOAD: (resourceId: number) => `/api/classes/resources/${resourceId}/download`,
    ACTIVITIES: (id: number) => `/api/classes/${id}/activities`,
    ACTIVITY_BY_ID: (classId: number, activityId: number) =>
      `/api/classes/${classId}/activities/${activityId}`,
    ACTIVITY_SUBMISSIONS: (activityId: number) =>
      `/api/classes/activities/${activityId}/submissions`,
    SUBMISSION_GRADE: (submissionId: number) =>
      `/api/classes/submissions/${submissionId}/grade`,
    FORUM_POSTS: (activityId: number) =>
      `/api/classes/activities/${activityId}/forum-posts`,
    ATTENDANCE: (activityId: number) =>
      `/api/classes/activities/${activityId}/attendance`,
    COMPLETIONS: (id: number) => `/api/classes/${id}/completions`,
    ROLES: (id: number) => `/api/classes/${id}/roles`,
    LOGS: (id: number) => `/api/classes/${id}/logs`,
    STUDENTS: (id: number) => `/api/classes/${id}/students`,
    CLASSMATES: (id: number) => `/api/classes/${id}/classmates`,
    AVAILABLE_STUDENTS: (id: number) => `/api/classes/${id}/available-students`,
    CLASS_NAMES: '/api/classes/class-names',
    REMOVE_STUDENT: (classId: number, studentId: number) =>
      `/api/classes/${classId}/students/${studentId}`,
    IMPORT_STUDENTS: (id: number) => `/api/classes/${id}/students/import`,
    IMPORT_TEMPLATE: '/api/classes/import-template',
  },
  TIMETABLE: {
    CLASSES: '/api/timetable/classes',
    CLASS: (classId: number) => `/api/timetable/classes/${classId}`,
    SLOTS: (classId: number) => `/api/timetable/classes/${classId}/slots`,
    SLOT_BY_ID: (classId: number, slotId: number) =>
      `/api/timetable/classes/${classId}/slots/${slotId}`,
    CHECK_CONFLICTS: '/api/timetable/check-conflicts',
    IMPORT: (classId: number) => `/api/timetable/classes/${classId}/import`,
    IMPORT_TEMPLATE: '/api/timetable/import-template',
  },
  DISCUSSIONS: {
    BASE: '/api/discussions',
    BY_ID: (id: number) => `/api/discussions/${id}`,
    REPLIES: (id: number) => `/api/discussions/${id}/replies`,
    REPLY_BY_ID: (replyId: number) => `/api/discussions/replies/${replyId}`,
    ATTACHMENT_DOWNLOAD_URL: (attachmentId: number) =>
      `/api/discussions/attachments/${attachmentId}/download-url`,
    ADMIN_ALL: '/api/discussions/admin/all',
  },
  STUDENT_ANALYTICS: {
    DASHBOARD: '/api/student/dashboard',
    STRENGTHS: '/api/student/analytics/strengths',
    TIME: '/api/student/analytics/time',
    PATTERNS: '/api/student/analytics/patterns',
    KNOWLEDGE_GRAPH: '/api/student/analytics/knowledge-graph',
    ATTEMPTS: '/api/student/analytics/attempts',
  },
  TEACHER_ANALYTICS: {
    CLASS_DASHBOARD: (classId: number) => `/api/teacher/classes/${classId}/dashboard`,
    CLASS_PERFORMANCE: (classId: number) => `/api/teacher/classes/${classId}/analytics/performance`,
    EXAM_DISTRIBUTION: (examId: number) => `/api/teacher/exams/${examId}/analytics/distribution`,
    WEAK_STUDENTS: (classId: number) => `/api/teacher/classes/${classId}/analytics/weak-students`,
    COMPARE_CLASSES: '/api/teacher/analytics/compare-classes',
    EXAM_RESULTS: (examId: number) => `/api/teacher/exams/${examId}/results`,
    EXPORT_REPORT: '/api/teacher/reports/export',
  },
  QUESTIONS: {
    BASE: '/api/questions',
    BY_ID: (id: number) => `/api/questions/${id}`,
    IMPORT: '/api/questions/import',
    IMPORT_TEMPLATE: '/api/questions/import-template',
    DOCUMENT_IMPORT_TEMPLATE: '/api/questions/document-import-template',
    EXTRACT_FROM_DOCUMENT: '/api/questions/extract-from-document',
    IMPORT_ZIP: '/api/questions/import-zip',
    ZIP_IMPORT_TEMPLATE: '/api/questions/zip-import-template',
    BULK_CREATE: '/api/questions/bulk-create',
    BULK_DELETE: '/api/questions/bulk-delete',
    IMAGE_UPLOAD: '/api/questions/images',
    EXPORT_GIFT: '/api/questions/export-gift',
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
  PARENT: {
    CHILDREN: '/api/parent/children',
    CHILD_RESULTS: (childId: number) => `/api/parent/children/${childId}/results`,
    CHILD_DASHBOARD: (childId: number) => `/api/parent/children/${childId}/dashboard`,
    CHILD_STRENGTHS: (childId: number) => `/api/parent/children/${childId}/analytics/strengths`,
  },
  NOTIFICATIONS: {
    LIST: '/api/notifications',
    MARK_READ: (id: number) => `/api/notifications/${id}/read`,
    MARK_ALL_READ: '/api/notifications/read-all',
    PUSH_SUBSCRIBE: '/api/notifications/push/subscribe',
    PUSH_UNSUBSCRIBE: '/api/notifications/push/unsubscribe',
  },
} as const;
