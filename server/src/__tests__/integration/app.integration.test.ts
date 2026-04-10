import request from 'supertest';
import app from '../../app';
import { loginAsRole } from './helpers';

jest.mock('../../config/database', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
  getDatabaseStatus: jest
    .fn()
    .mockResolvedValue({ connected: true, message: 'PostgreSQL connected via Prisma' }),
}));

jest.mock('../../config/redis', () => ({
  getRedisClient: () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(60),
    scan: jest.fn().mockResolvedValue(['0', []]),
  }),
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
  getRedisStatus: jest.fn().mockResolvedValue({ connected: true, message: 'Redis OK' }),
}));

jest.mock('../../config/minio', () => ({
  getMinioStatus: jest.fn().mockResolvedValue({ connected: true, message: 'MinIO OK' }),
}));

describe('App Integration Tests', () => {
  describe('Health Check', () => {
    it('GET /health should return 200', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('WebQuiz API is running');
      expect(res.body.data).toHaveProperty('environment');
      expect(res.body.data).toHaveProperty('uptime');
    });
  });

  describe('API Index', () => {
    it('GET /api should return API information', async () => {
      const res = await request(app).get('/api');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.endpoints).toBeDefined();
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Route not found');
    });
  });

  describe('RBAC - Role-Based Access Control', () => {
    it('should reject unauthenticated requests to protected endpoints', async () => {
      const res = await request(app).get('/api/admin/users');

      expect(res.status).toBe(401);
    });

    it('student should not access admin routes (403)', async () => {
      const { authHeader } = loginAsRole('student');

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', authHeader);

      expect([401, 403]).toContain(res.status);
    });

    it('student should not access admin system routes', async () => {
      const { authHeader } = loginAsRole('student');

      const res = await request(app)
        .get('/api/admin/system/configs')
        .set('Authorization', authHeader);

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('Validation', () => {
    it('POST /api/auth/login with invalid body should return 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'ab', password: '12' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/login with empty body should return 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
