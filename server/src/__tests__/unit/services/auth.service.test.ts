import '../../mocks/redis';
import '../../mocks/prisma';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prismaMock } from '../../mocks/prisma';
import { redisMock, clearRedisStore } from '../../mocks/redis';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

import { AuthService } from '../../../modules/auth/auth.service';

const authService = new AuthService();

const mockUser = {
  id: 1,
  username: 'teststudent',
  email: 'student@test.com',
  passwordHash: '',
  fullName: 'Test Student',
  phone: null,
  avatar: null,
  status: 'ACTIVE' as const,
  roleId: 1,
  lastLoginAt: null,
  createdAt: new Date(),
  role: { id: 1, name: 'student', description: 'Student role' },
};

beforeAll(async () => {
  mockUser.passwordHash = await bcrypt.hash('Password123!', 10);
});

afterEach(() => {
  jest.clearAllMocks();
  clearRedisStore();
});

describe('AuthService', () => {
  describe('login', () => {
    it('should return tokens and user on valid credentials', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'student@test.com',
        password: 'Password123!',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('student@test.com');
      expect(result.user.role).toBe('student');
      expect(redisMock.set).toHaveBeenCalled();
    });

    it('should throw 401 when user not found', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'noone@test.com', password: 'Password123!' }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw 401 on wrong password', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        authService.login({ email: 'student@test.com', password: 'WrongPass!' }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw 403 when account is suspended', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      });

      await expect(
        authService.login({ email: 'student@test.com', password: 'Password123!' }),
      ).rejects.toThrow('Account is disabled or suspended');
    });

    it('should generate valid JWT with correct payload', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'student@test.com',
        password: 'Password123!',
      });

      const decoded = jwt.verify(
        result.accessToken,
        process.env.JWT_SECRET!,
      ) as jwt.JwtPayload;

      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe('student@test.com');
      expect(decoded.role).toBe('student');
    });

    it('should update lastLoginAt on successful login', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(mockUser);

      await authService.login({
        email: 'student@test.com',
        password: 'Password123!',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { lastLoginAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('logout', () => {
    it('should delete refresh token from Redis', async () => {
      const result = await authService.logout('some-refresh-token', undefined);

      expect(result.success).toBe(true);
      expect(redisMock.del).toHaveBeenCalledWith('refresh_token:some-refresh-token');
    });

    it('should succeed even with empty token', async () => {
      const result = await authService.logout('', undefined);

      expect(result.success).toBe(true);
    });
  });

  describe('refresh', () => {
    it('should issue new tokens when refresh token is valid', async () => {
      redisMock.get.mockResolvedValueOnce('1');
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.refresh('valid-refresh-token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(redisMock.del).toHaveBeenCalled();
    });

    it('should throw 401 for expired/invalid refresh token', async () => {
      redisMock.get.mockResolvedValueOnce(null);

      await expect(
        authService.refresh('invalid-token'),
      ).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should throw 401 if user no longer active', async () => {
      redisMock.get.mockResolvedValueOnce('1');
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'INACTIVE',
      });

      await expect(
        authService.refresh('valid-token'),
      ).rejects.toThrow('User not found or account disabled');
    });
  });

  describe('forgotPassword', () => {
    it('should always return success message (no user enumeration)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await authService.forgotPassword({ email: 'noone@test.com' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('If the email exists');
    });

    it('should create reset token when user exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.passwordResetToken.create.mockResolvedValue({
        id: 1,
        userId: 1,
        token: 'reset-token',
        expiresAt: new Date(Date.now() + 900000),
        createdAt: new Date(),
      });

      const result = await authService.forgotPassword({ email: 'student@test.com' });

      expect(result.success).toBe(true);
      expect(prismaMock.passwordResetToken.create).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const resetRecord = {
        id: 1,
        userId: 1,
        token: 'valid-reset-token',
        expiresAt: new Date(Date.now() + 900000),
        createdAt: new Date(),
        user: mockUser,
      };

      prismaMock.passwordResetToken.findUnique.mockResolvedValue(resetRecord);
      prismaMock.$transaction.mockResolvedValue([]);
      redisMock.keys.mockResolvedValue([]);

      const result = await authService.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Password has been reset');
    });

    it('should throw 400 for invalid reset token', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          token: 'invalid-token',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw 400 for expired token', async () => {
      prismaMock.passwordResetToken.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 100000),
        createdAt: new Date(),
        user: mockUser,
      });
      prismaMock.passwordResetToken.delete.mockResolvedValue({});

      await expect(
        authService.resetPassword({
          token: 'expired-token',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow('Reset token has expired');
    });
  });
});
