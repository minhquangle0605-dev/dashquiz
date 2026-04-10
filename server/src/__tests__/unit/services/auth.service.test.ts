import '../../mocks/redis';
import '../../mocks/prisma';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prismaMock } from '../../mocks/prisma';
import { redisMock, clearRedisStore } from '../../mocks/redis';

import { AuthService } from '../../../modules/auth/auth.service';

const testIp = '127.0.0.1';

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

      const result = await authService.login(
        {
          username: 'teststudent',
          password: 'Password123!',
        },
        testIp,
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('student@test.com');
      expect(result.user.role).toBe('student');
      expect(redisMock.set).toHaveBeenCalled();
    });

    it('should throw 401 when user not found', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.login({ username: 'noone', password: 'Password123!' }, testIp),
      ).rejects.toThrow('Invalid username or password');
    });

    it('should throw 401 on wrong password', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        authService.login({ username: 'teststudent', password: 'WrongPass!' }, testIp),
      ).rejects.toThrow('Invalid username or password');
    });

    it('should throw 403 when account is suspended', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      });

      await expect(
        authService.login({ username: 'teststudent', password: 'Password123!' }, testIp),
      ).rejects.toThrow('Account is disabled or suspended');
    });

    it('should generate valid JWT with correct payload', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(mockUser);

      const result = await authService.login(
        {
          username: 'teststudent',
          password: 'Password123!',
        },
        testIp,
      );

      const decoded = jwt.verify(
        result.accessToken,
        process.env.JWT_SECRET!,
      ) as jwt.JwtPayload;

      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe('student@test.com');
      expect(decoded.role).toBe('student');
      expect((decoded as { username?: string }).username).toBe('teststudent');
    });

    it('should update lastLoginAt on successful login', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(mockUser);

      await authService.login(
        {
          username: 'teststudent',
          password: 'Password123!',
        },
        testIp,
      );

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { lastLoginAt: expect.any(Date) },
        }),
      );
    });

    it('should return 429 after five failed password attempts for the same username', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      for (let i = 0; i < 5; i++) {
        await expect(
          authService.login({ username: 'teststudent', password: 'WrongPass!' }, testIp),
        ).rejects.toThrow('Invalid username or password');
      }
      await expect(
        authService.login({ username: 'teststudent', password: 'WrongPass!' }, testIp),
      ).rejects.toMatchObject({
        statusCode: 429,
        data: { retryAfterSeconds: expect.any(Number) },
      });
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
});
