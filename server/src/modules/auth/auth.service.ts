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
    return jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        username: payload.username,
        role: payload.role,
        jti,
      },
      env.jwt.secret,
      { expiresIn: env.jwt.accessExpiry as StringValue },
    );
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  private async storeRefreshToken(userId: number, token: string): Promise<void> {
    const redis = getRedisClient();
    await redis.set(`${REFRESH_PREFIX}${token}`, userId.toString(), 'EX', REFRESH_TTL);
  }

  private async deleteRefreshToken(token: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(`${REFRESH_PREFIX}${token}`);
  }

  private async getRefreshTokenUserId(token: string): Promise<number | null> {
    const redis = getRedisClient();
    const userId = await redis.get(`${REFRESH_PREFIX}${token}`);
    return userId ? parseInt(userId, 10) : null;
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
      include: { role: true },
    });

    if (!user) {
      await recordLoginFailure(clientIp, userKey);
      throw new AppError('Invalid username or password', 401);
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Account is disabled or suspended', 403);
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      await recordLoginFailure(clientIp, userKey);
      throw new AppError('Invalid username or password', 401);
    }

    await clearLoginFailureState(clientIp, userKey);

    const roleName = user.role.name.toLowerCase();

    const jwtPayload: JwtPayload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: roleName,
    };

    const accessToken = this.generateAccessToken(jwtPayload);
    const refreshToken = this.generateRefreshToken();

    await this.storeRefreshToken(user.id, refreshToken);

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
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        role: roleName,
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
    const userId = await this.getRefreshTokenUserId(refreshToken);
    if (!userId) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      await this.deleteRefreshToken(refreshToken);
      throw new AppError('User not found or account disabled', 401);
    }

    await this.deleteRefreshToken(refreshToken);

    const jwtPayload: JwtPayload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.name.toLowerCase(),
    };

    const newAccessToken = this.generateAccessToken(jwtPayload);
    const newRefreshToken = this.generateRefreshToken();

    await this.storeRefreshToken(user.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}

export const authService = new AuthService();
