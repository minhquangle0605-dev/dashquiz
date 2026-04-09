/** Mirrors server `ServerEvents` / `ClientEvents` for typed client usage. */

export const SERVER_SOCKET_EVENTS = {
  EXAM_STARTED: 'exam:started',
  EXAM_STUDENT_SUBMITTED: 'exam:student-submitted',
  EXAM_TIME_WARNING: 'exam:time-warning',
  EXAM_CLOSED: 'exam:closed',
  NOTIFICATION_NEW: 'notification:new',
  DASHBOARD_UPDATE: 'dashboard:update',
} as const;

export const CLIENT_SOCKET_EVENTS = {
  JOIN_EXAM: 'exam:join',
  LEAVE_EXAM: 'exam:leave',
  EXAM_HEARTBEAT: 'exam:heartbeat',
} as const;

export type ServerSocketEventName =
  (typeof SERVER_SOCKET_EVENTS)[keyof typeof SERVER_SOCKET_EVENTS];
