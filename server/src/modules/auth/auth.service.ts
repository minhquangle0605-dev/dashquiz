import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { getRedisClient } from '../../config/redis';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { TOKEN_BLACKLIST_PREFIX } from '../../utils/constants';
import type { JwtPayload } from '../../types/common';
import type { LoginInput } from './auth.validation';
import {
  assertLoginNotLocked,
  clearLoginFailureState,
  normalizeLoginUsername,
  recordLoginFailure,
} from '../../utils/loginLockout';

const REFRESH_PREFIX = 'refresh_token:';
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export class AuthService {
  private generateAccessToken(payload: JwtPayload): string {
    const jti = crypto.randomBytes(16).toString('hex');
    const body: Record<string, unknown> = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      jti,
    };
    if (payload.studentId !== undefined) body.studentId = payload.studentId;
    return jwt.sign(body, env.jwt.secret, {
      expiresIn: env.jwt.accessExpiry as StringValue,
    });
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  private async storeRefreshToken(userId: number, token: string, role: string): Promise<void> {
    const redis = getRedisClient();
    // Store "<userId>:<role>" so refresh can re-issue a parent-scoped token without
    // a second DB roundtrip and without losing the dual-login distinction.
    await redis.set(`${REFRESH_PREFIX}${token}`, `${userId}:${role}`, 'EX', REFRESH_TTL);
  }

  private async deleteRefreshToken(token: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(`${REFRESH_PREFIX}${token}`);
  }

  private async getRefreshTokenSession(token: string): Promise<{ userId: number; role: string } | null> {
    const redis = getRedisClient();
    const raw = await redis.get(`${REFRESH_PREFIX}${token}`);
    if (!raw) return null;
    const [idStr, role] = raw.split(':');
    const userId = parseInt(idStr, 10);
    if (!Number.isFinite(userId)) return null;
    // Legacy tokens stored only userId — fall back to the user's DB role.
    return { userId, role: role || '' };
  }

  /**
   * Blacklist an access token so it cannot be reused after logout.
   * TTL = remaining lifetime of the token.
   * Reference: https://redis.io/tutorials/authentication-token-storage-with-redis/
   */
  async blacklistAccessToken(accessToken: string): Promise<void> {
    try {
      const decoded = jwt.decode(accessToken) as JwtPayload | null;
      if (!decoded?.jti || !decoded.exp) return;

      const remainingSec = decoded.exp - Math.floor(Date.now() / 1000);
      if (remainingSec <= 0) return;

      const redis = getRedisClient();
      await redis.set(`${TOKEN_BLACKLIST_PREFIX}${decoded.jti}`, '1', 'EX', remainingSec);
    } catch (err) {
      logger.warn('Failed to blacklist access token:', err);
    }
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.get(`${TOKEN_BLACKLIST_PREFIX}${jti}`);
      return result !== null;
    } catch {
      return false;
    }
  }

  async login(data: LoginInput, clientIp: string) {
    const username = data.username.trim();
    const userKey = normalizeLoginUsername(username);
    await assertLoginNotLocked(clientIp, userKey);

    const user = await prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
      },
    });

    if (!user) {
      await recordLoginFailure(clientIp, userKey);
      throw new AppError('Invalid username or password', 401);
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Account is disabled or suspended', 403);
    }

    // Dual-login: STUDENT records may carry a parent password. Try the student's
    // own password first; if it matches, role from DB. Otherwise (and only for
    // students) try the parent password and grant the virtual PARENT role.
    let resolvedRole: string;
    let studentId: number | undefined;

    const studentMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (studentMatch) {
      resolvedRole = user.role.toLowerCase();
    } else if (user.role === 'STUDENT' && user.parentPasswordHash) {
      const parentMatch = await bcrypt.compare(data.password, user.parentPasswordHash);
      if (!parentMatch) {
        await recordLoginFailure(clientIp, userKey);
        throw new AppError('Invalid username or password', 401);
      }
      resolvedRole = 'parent';
      studentId = user.id;
    } else {
      await recordLoginFailure(clientIp, userKey);
      throw new AppError('Invalid username or password', 401);
    }

    await clearLoginFailureState(clientIp, userKey);

    const jwtPayload: JwtPayload = {
      id: user.id,
      username: user.username,
      role: resolvedRole,
      studentId,
    };

    const accessToken = this.generateAccessToken(jwtPayload);
    const refreshToken = this.generateRefreshToken();

    await this.storeRefreshToken(user.id, refreshToken, resolvedRole);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar,
        role: resolvedRole,
      },
    };
  }

  async logout(refreshToken: string | undefined, accessToken: string | undefined) {
    if (refreshToken) {
      await this.deleteRefreshToken(refreshToken);
    }
    if (accessToken) {
      await this.blacklistAccessToken(accessToken);
    }

    return { success: true, message: 'Logout successful', data: null };
  }

  async refresh(refreshToken: string) {
    const session = await this.getRefreshTokenSession(refreshToken);
    if (!session) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user || user.status !== 'ACTIVE') {
      await this.deleteRefreshToken(refreshToken);
      throw new AppError('User not found or account disabled', 401);
    }

    await this.deleteRefreshToken(refreshToken);

    const resolvedRole = session.role || user.role.toLowerCase();
    const studentId = resolvedRole === 'parent' ? user.id : undefined;

    const jwtPayload: JwtPayload = {
      id: user.id,
      username: user.username,
      role: resolvedRole,
      studentId,
    };

    const newAccessToken = this.generateAccessToken(jwtPayload);
    const newRefreshToken = this.generateRefreshToken();

    await this.storeRefreshToken(user.id, newRefreshToken, resolvedRole);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}

export const authService = new AuthService();
