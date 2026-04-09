import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

import { env } from '../config/env';
import { logger } from '../utils/logger';
import { socketAuthMiddleware, type AuthenticatedSocket } from './socketAuth';
import { rooms, ServerEvents, ClientEvents } from './events';
import { registerHandlers } from './handlers';

let io: SocketIOServer | null = null;

/**
 * Initialize the Socket.IO server, attach Redis adapter, apply auth
 * middleware, wire up connection / disconnection handlers.
 */
export function initSocketServer(httpServer: http.Server): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: env.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
    connectTimeout: 10_000,
    transports: ['websocket', 'polling'],
  });

  // ─── Redis Adapter (pub/sub pair) ─────────────
  try {
    const redisOpts = {
      host: env.redis.host,
      port: env.redis.port,
      password: env.redis.password || undefined,
      retryStrategy(times: number) {
        if (times > 10) return null;
        return Math.min(times * 200, 5000);
      },
    };

    const pubClient = new Redis(redisOpts);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.warn('[Socket.IO] Redis pub error:', err.message));
    subClient.on('error', (err) => logger.warn('[Socket.IO] Redis sub error:', err.message));

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('[Socket.IO] Redis adapter attached (multi-instance ready)');
  } catch (error) {
    logger.warn('[Socket.IO] Redis adapter setup failed — falling back to in-memory:', error);
  }

  // ─── Auth Middleware ──────────────────────────
  io.use(socketAuthMiddleware);

  // ─── Connection Handler ──────────────────────
  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId, role } = socket.data;

    // Auto-join the user's personal room
    socket.join(rooms.user(userId));
    logger.debug(`[Socket.IO] User ${userId} (${role}) connected → socket ${socket.id}`);

    // Register client→server event handlers
    registerHandlers(socket);

    socket.on('disconnect', (reason) => {
      logger.debug(`[Socket.IO] User ${userId} disconnected (${reason})`);
    });

    socket.on('error', (err) => {
      logger.warn(`[Socket.IO] Socket error for user ${userId}:`, err.message);
    });
  });

  logger.info('[Socket.IO] Server initialized');
  return io;
}

/**
 * Returns the singleton Socket.IO server instance.
 * Throws if called before `initSocketServer()`.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized — call initSocketServer() first');
  }
  return io;
}

/**
 * Safe getter that returns null instead of throwing when
 * Socket.IO has not been initialized yet.
 */
export function getIOSafe(): SocketIOServer | null {
  return io;
}

// ═══════════════════════════════════════════════════
// Emit helpers — called from services to push events
// ═══════════════════════════════════════════════════

/**
 * Emit `exam:started` to every student in the assigned classes.
 */
export function emitExamStarted(
  classIds: number[],
  payload: { examId: number; title: string; subjectName: string; durationMin: number },
): void {
  const server = getIOSafe();
  if (!server) return;

  for (const classId of classIds) {
    server.to(rooms.class(classId)).emit(ServerEvents.EXAM_STARTED, payload);
  }
  logger.debug(`[Socket.IO] exam:started → classes [${classIds.join(', ')}]`);
}

/**
 * Emit `exam:student-submitted` to the exam room so the teacher
 * can see real-time who has submitted.
 */
export function emitStudentSubmitted(
  examId: number,
  payload: {
    attemptId: number;
    studentId: number;
    studentName: string;
    totalScore: number;
    totalQuestions: number;
    correctCount: number;
    isAutoSubmitted: boolean;
    submittedAt: Date;
  },
): void {
  const server = getIOSafe();
  if (!server) return;

  server.to(rooms.exam(examId)).emit(ServerEvents.EXAM_STUDENT_SUBMITTED, payload);
  logger.debug(`[Socket.IO] exam:student-submitted → exam:${examId} (student ${payload.studentId})`);
}

/**
 * Emit `notification:new` to a specific user's personal room.
 */
export function emitNotification(
  userId: number,
  payload: { id: number; title: string; message: string; type: string; createdAt: Date },
): void {
  const server = getIOSafe();
  if (!server) return;

  server.to(rooms.user(userId)).emit(ServerEvents.NOTIFICATION_NEW, payload);
}

/**
 * Emit `exam:time-warning` to all students currently in the exam room.
 */
export function emitExamTimeWarning(
  examId: number,
  payload: { examId: number; minutesRemaining: number; message: string },
): void {
  const server = getIOSafe();
  if (!server) return;

  server.to(rooms.exam(examId)).emit(ServerEvents.EXAM_TIME_WARNING, payload);
  logger.debug(`[Socket.IO] exam:time-warning → exam:${examId} (${payload.minutesRemaining}min left)`);
}

/**
 * Emit `exam:closed` to everyone in the exam room.
 */
export function emitExamClosed(
  examId: number,
  payload: { examId: number; title: string },
): void {
  const server = getIOSafe();
  if (!server) return;

  server.to(rooms.exam(examId)).emit(ServerEvents.EXAM_CLOSED, payload);
  logger.debug(`[Socket.IO] exam:closed → exam:${examId}`);
}

/**
 * Emit `dashboard:update` to a specific user's room, signaling
 * the client to refetch / invalidate cached data.
 */
export function emitDashboardUpdate(
  userId: number,
  payload: { reason: string; entityType?: string; entityId?: number },
): void {
  const server = getIOSafe();
  if (!server) return;

  server.to(rooms.user(userId)).emit(ServerEvents.DASHBOARD_UPDATE, payload);
}

/**
 * Broadcast `dashboard:update` to multiple users at once.
 */
export function emitDashboardUpdateBulk(
  userIds: number[],
  payload: { reason: string; entityType?: string; entityId?: number },
): void {
  const server = getIOSafe();
  if (!server) return;

  for (const uid of userIds) {
    server.to(rooms.user(uid)).emit(ServerEvents.DASHBOARD_UPDATE, payload);
  }
}
