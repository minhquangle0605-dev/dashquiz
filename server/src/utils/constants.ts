// JWT/request-level role strings (lowercase). PARENT is virtual: only set when
// login matches parentPasswordHash on a STUDENT user. DB stores UserRole enum
// (ADMIN/TEACHER/STUDENT) — auth service normalises to lowercase for tokens.
export const ROLES = {
  STUDENT: 'student',
  PARENT: 'parent',
  TEACHER: 'teacher',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

export const EXAM_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  SCHEDULED: 'scheduled',
  CLOSED: 'closed',
} as const;

export const ATTEMPT_STATUS = {
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  GRADED: 'graded',
} as const;

export const COMPLETED_ATTEMPT_STATUSES = ['SUBMITTED', 'GRADED'] as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const RATE_LIMIT = {
  /** Failed login attempts (per IP + username) before lockout */
  LOGIN_MAX_FAILED_ATTEMPTS: 5,
  /** Seconds before next login attempt is allowed after lockout */
  LOGIN_LOCKOUT_SECONDS: 30,
  /** Window for counting consecutive failures (resets counter if idle) */
  LOGIN_FAIL_COUNT_WINDOW_SEC: 15 * 60,
  API_MAX: 100,
  API_WINDOW_MS: 60 * 1000, // 1 minute
} as const;

export const FILE_UPLOAD = {
  MAX_AVATAR_SIZE: 2 * 1024 * 1024, // 2MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_QUESTION_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_EXCEL_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_DOCUMENT_SIZE: 15 * 1024 * 1024, // 15MB (Word / PDF question imports)
  MAX_CLASS_IMAGE_RESOURCE_SIZE: 10 * 1024 * 1024, // 10MB (course images)
  ALLOWED_CLASS_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  MAX_CLASS_RESOURCE_SIZE: 100 * 1024 * 1024, // 100MB (course files/videos)
  MAX_DISCUSSION_ATTACHMENT_SIZE: 100 * 1024 * 1024, // 100MB (discussion files/videos)
  MAX_DISCUSSION_ATTACHMENTS: 5,
} as const;

export const TOKEN_BLACKLIST_PREFIX = 'bl:' as const;
export const REFRESH_COOKIE_NAME = 'webquiz_rt' as const;
