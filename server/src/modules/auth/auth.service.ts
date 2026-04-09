import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '../../config/database';
import { getRedisClient } from '../../config/redis';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { TOKEN_BLACKLIST_PREFIX } from '../../utils/constants';
import type { JwtPayload } from '../../types/common';
import type {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth.validation';

const REFRESH_PREFIX = 'refresh_token:';
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export class AuthService {
  private generateAccessToken(payload: JwtPayload): string {
    const jti = crypto.randomBytes(16).toString('hex');
    return jwt.sign(
      { id: payload.id, email: payload.email, role: payload.role, jti },
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
   * Revoke all refresh tokens for a user via SCAN (non-blocking, production-safe).
   * Reference: https://redis.io/docs/latest/commands/scan/
   */
  private async deleteAllRefreshTokensForUser(userId: number): Promise<void> {
    const redis = getRedisClient();
    const userIdStr = userId.toString();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${REFRESH_PREFIX}*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const val = await redis.get(key);
        if (val === userIdStr) {
          await redis.del(key);
        }
      }
    } while (cursor !== '0');
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

  private getTransporter() {
    return nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.password,
      },
    });
  }

  async login(data: LoginInput) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.email }],
      },
      include: { role: true },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Account is disabled or suspended', 403);
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const jwtPayload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role.name,
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
        role: user.role.name,
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
      role: user.role.name,
    };

    const newAccessToken = this.generateAccessToken(jwtPayload);
    const newRefreshToken = this.generateRefreshToken();

    await this.storeRefreshToken(user.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
        data: null,
      };
    }

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    try {
      const resetUrl = `${env.clientUrl}/reset-password?token=${token}`;
      const transporter = this.getTransporter();

      await transporter.sendMail({
        from: `"WebQuiz" <${env.smtp.user}>`,
        to: user.email,
        subject: 'Password Reset Request - WebQuiz',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Password Reset</h2>
            <p>Hello <strong>${user.fullName || user.username}</strong>,</p>
            <p>You have requested to reset your password. Click the button below:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Reset Password
            </a>
            <p style="color: #64748b; font-size: 14px;">This link will expire in 15 minutes.</p>
            <p style="color: #64748b; font-size: 14px;">If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
    }

    return {
      success: true,
      message: 'If the email exists, a password reset link has been sent',
      data: null,
    };
  }

  async resetPassword(data: ResetPasswordInput) {
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token: data.token },
      include: { user: true },
    });

    if (!resetRecord) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    if (resetRecord.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetRecord.id } });
      throw new AppError('Reset token has expired', 400);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.newPassword, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: resetRecord.userId },
      }),
    ]);

    await this.deleteAllRefreshTokensForUser(resetRecord.userId);

    return {
      success: true,
      message: 'Password has been reset successfully',
      data: null,
    };
  }
}

export const authService = new AuthService();
