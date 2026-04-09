export { initSocketServer, getIO, getIOSafe } from './socketManager';
export {
  emitExamStarted,
  emitStudentSubmitted,
  emitNotification,
  emitExamTimeWarning,
  emitExamClosed,
  emitDashboardUpdate,
  emitDashboardUpdateBulk,
} from './socketManager';
export { rooms, ServerEvents, ClientEvents } from './events';
export type { AuthenticatedSocket } from './socketAuth';
