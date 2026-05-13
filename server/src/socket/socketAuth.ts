import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { JwtPayload } from '../types/common';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: number;
    username: string;
    role: string;
  };
}

/**
 * Socket.IO middleware that verifies the JWT sent via `auth.token`
 * on every new connection. Rejects with an error if the token is
 * missing, expired, or invalid.
 */
export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  try {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error('Authentication required — no token provided'));
    }

    const decoded = jwt.verify(token, env.jwt.secret) as JwtPayload;

    socket.data = {
      userId: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug(`[Socket] Token expired for socket ${socket.id}`);
      return next(new Error('Token expired'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      logger.debug(`[Socket] Invalid token for socket ${socket.id}`);
      return next(new Error('Invalid token'));
    }
    logger.warn(`[Socket] Auth failed for socket ${socket.id}:`, error);
    next(new Error('Authentication failed'));
  }
}
