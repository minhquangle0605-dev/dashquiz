import '../../mocks/redis';

import { Request, Response, NextFunction } from 'express';
import { redisMock, clearRedisStore } from '../../mocks/redis';
import { rateLimiter } from '../../../middlewares/rateLimiter';

function createMockReqRes() {
  const req = {
    path: '/api/auth/login',
    ip: '127.0.0.1',
  } as unknown as Request;

  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;

  const next = jest.fn() as jest.MockedFunction<NextFunction>;

  return { req, res, next };
}

afterEach(() => {
  jest.clearAllMocks();
  clearRedisStore();
});

describe('rateLimiter middleware', () => {
  it('should allow request under the limit', async () => {
    redisMock.incr.mockResolvedValueOnce(1);
    const { req, res, next } = createMockReqRes();

    const middleware = rateLimiter(5, 60000);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
  });

  it('should block request over the limit with 429', async () => {
    redisMock.incr.mockResolvedValueOnce(6);
    const { req, res, next } = createMockReqRes();

    const middleware = rateLimiter(5, 60000);
    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Too many requests'),
      }),
    );
  });

  it('should set TTL on first request', async () => {
    redisMock.incr.mockResolvedValueOnce(1);
    const { req, res, next } = createMockReqRes();

    const middleware = rateLimiter(10, 30000);
    await middleware(req, res, next);

    expect(redisMock.expire).toHaveBeenCalledWith(
      expect.any(String),
      30,
    );
  });

  it('should set rate limit headers', async () => {
    redisMock.incr.mockResolvedValueOnce(3);
    const { req, res, next } = createMockReqRes();

    const middleware = rateLimiter(10, 60000);
    await middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 7);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
  });

  it('should allow request on Redis error (fail-open)', async () => {
    redisMock.incr.mockRejectedValueOnce(new Error('Redis down'));
    const { req, res, next } = createMockReqRes();

    const middleware = rateLimiter(5, 60000);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
