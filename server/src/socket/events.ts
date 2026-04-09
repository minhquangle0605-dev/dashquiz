/**
 * Centralized Socket.IO event names and room key helpers.
 *
 * Room strategy:
 *   user:{userId}   — personal channel (notifications, dashboard updates)
 *   class:{classId}  — class-wide broadcasts (new exam assigned)
 *   exam:{examId}    — exam-specific (teacher watches submissions, time warnings)
 */

// ─── Room Key Builders ────────────────────────────

export const rooms = {
  user: (userId: number) => `user:${userId}`,
  class: (classId: number) => `class:${classId}`,
  exam: (examId: number) => `exam:${examId}`,
} as const;

// ─── Server → Client Events ──────────────────────

export const ServerEvents = {
  /** Exam transitions to PUBLISHED → broadcast to assigned classes */
  EXAM_STARTED: 'exam:started',

  /** A student submitted their attempt → teacher monitoring room */
  EXAM_STUDENT_SUBMITTED: 'exam:student-submitted',

  /** Time warning (e.g. 5 min remaining) → students in exam room */
  EXAM_TIME_WARNING: 'exam:time-warning',

  /** Exam closed by schedule → students in exam room */
  EXAM_CLOSED: 'exam:closed',

  /** New in-app notification → user personal room */
  NOTIFICATION_NEW: 'notification:new',

  /** Dashboard data changed → invalidate client cache */
  DASHBOARD_UPDATE: 'dashboard:update',
} as const;

// ─── Client → Server Events ─────────────────────

export const ClientEvents = {
  /** Client requests to join specific rooms (e.g. exam monitoring) */
  JOIN_EXAM: 'exam:join',

  /** Client leaves an exam room */
  LEAVE_EXAM: 'exam:leave',

  /** Heartbeat ping from client during exam */
  EXAM_HEARTBEAT: 'exam:heartbeat',
} as const;
