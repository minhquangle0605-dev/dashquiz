import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { rooms, ClientEvents, ServerEvents } from './events';
import type { AuthenticatedSocket } from './socketAuth';

/**
 * Register client→server event handlers for an authenticated socket.
 * Called once per connection in socketManager's `connection` handler.
 */
export function registerHandlers(socket: AuthenticatedSocket): void {
  const { userId, role } = socket.data;

  // ─── exam:join ────────────────────────────────
  // Teachers join to monitor real-time submissions.
  // Students join to receive time-warnings.
  socket.on(ClientEvents.JOIN_EXAM, async (data: { examId: number }) => {
    try {
      const examId = data?.examId;
      if (!examId || typeof examId !== 'number') return;

      if (role === 'teacher' || role === 'admin') {
        const exam = await prisma.exam.findFirst({
          where: { id: examId, createdBy: userId },
        });
        if (!exam && role !== 'admin') {
          socket.emit('error', { message: 'You do not own this exam' });
          return;
        }
      } else if (role === 'student') {
        const attempt = await prisma.examAttempt.findFirst({
          where: { examId, studentId: userId, status: 'IN_PROGRESS' },
        });
        if (!attempt) {
          socket.emit('error', { message: 'No active attempt for this exam' });
          return;
        }
      }

      socket.join(rooms.exam(examId));
      logger.debug(`[Socket.IO] User ${userId} joined exam:${examId}`);
    } catch (err) {
      logger.warn(`[Socket.IO] exam:join error for user ${userId}:`, err);
    }
  });

  // ─── exam:leave ───────────────────────────────
  socket.on(ClientEvents.LEAVE_EXAM, (data: { examId: number }) => {
    const examId = data?.examId;
    if (!examId || typeof examId !== 'number') return;

    socket.leave(rooms.exam(examId));
    logger.debug(`[Socket.IO] User ${userId} left exam:${examId}`);
  });

  // ─── exam:heartbeat ──────────────────────────
  // Students send periodic heartbeats so the teacher's monitoring
  // view knows who is still actively taking the exam.
  socket.on(ClientEvents.EXAM_HEARTBEAT, (data: {
    examId: number;
    attemptId: number;
    answeredCount?: number;
    unansweredCount?: number;
    timeRemainingSec?: number;
    currentQuestionId?: number | null;
  }) => {
    const examId = data?.examId;
    if (!examId || typeof examId !== 'number') return;

    socket.to(rooms.exam(examId)).emit(ServerEvents.EXAM_HEARTBEAT, {
      studentId: userId,
      attemptId: data.attemptId,
      answeredCount: data.answeredCount,
      unansweredCount: data.unansweredCount,
      timeRemainingSec: data.timeRemainingSec,
      currentQuestionId: data.currentQuestionId ?? null,
      occurredAt: new Date(),
    });
  });

  // ─── Auto-join class rooms on connection ──────
  autoJoinClassRooms(socket, userId).catch((err) =>
    logger.warn(`[Socket.IO] Failed to auto-join class rooms for user ${userId}:`, err),
  );
}

/**
 * Look up the classes the user belongs to (student → enrolled,
 * teacher → teaching) and auto-join those class rooms so they
 * receive `exam:started` broadcasts.
 */
async function autoJoinClassRooms(socket: AuthenticatedSocket, userId: number): Promise<void> {
  const { role } = socket.data;

  let classIds: number[] = [];

  if (role === 'student') {
    const enrollments = await prisma.classStudent.findMany({
      where: { studentId: userId },
      select: { classId: true },
    });
    classIds = enrollments.map((e) => e.classId);
  } else if (role === 'teacher') {
    const teaching = await prisma.class.findMany({
      where: { teacherId: userId },
      select: { id: true },
    });
    classIds = teaching.map((c) => c.id);
  }

  for (const classId of classIds) {
    socket.join(rooms.class(classId));
  }

  if (classIds.length > 0) {
    logger.debug(
      `[Socket.IO] User ${userId} auto-joined ${classIds.length} class room(s)`,
    );
  }
}
