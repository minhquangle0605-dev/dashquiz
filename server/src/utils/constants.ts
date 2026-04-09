export const ROLES = {
  STUDENT: 'student',
  PARENT: 'parent',
  TEACHER: 'teacher',
  ADMIN: 'admin',
} as const;

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

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const RATE_LIMIT = {
  LOGIN_MAX: 5,
  LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  API_MAX: 100,
  API_WINDOW_MS: 60 * 1000, // 1 minute
} as const;

export const FILE_UPLOAD = {
  MAX_AVATAR_SIZE: 2 * 1024 * 1024, // 2MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_EXCEL_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

export const TOKEN_BLACKLIST_PREFIX = 'bl:' as const;
export const REFRESH_COOKIE_NAME = 'webquiz_rt' as const;
