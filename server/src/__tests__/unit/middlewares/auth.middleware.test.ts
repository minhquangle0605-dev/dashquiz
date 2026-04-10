import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../../middlewares/auth';

const JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_SECRET = JWT_SECRET;

function createMockReqRes(headers: Record<string, string> = {}) {
  const req = {
    headers,
    user: undefined,
  } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  return { req, res, next };
}

describe('authenticate middleware', () => {
  it('should set req.user with valid token', () => {
    const token = jwt.sign(
      { id: 1, email: 'test@test.com', username: 'testuser', role: 'student' },
      JWT_SECRET,
    );
    const { req, res, next } = createMockReqRes({
      authorization: `Bearer ${token}`,
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user!.id).toBe(1);
    expect(req.user!.email).toBe('test@test.com');
    expect(req.user!.role).toBe('student');
  });

  it('should call next with error when no Authorization header', () => {
    const { req, res, next } = createMockReqRes();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Authentication required', statusCode: 401 }),
    );
  });

  it('should call next with error when Authorization header has no Bearer prefix', () => {
    const { req, res, next } = createMockReqRes({
      authorization: 'Basic some-token',
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it('should call next with error for invalid token', () => {
    const { req, res, next } = createMockReqRes({
      authorization: 'Bearer invalid-token',
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid token', statusCode: 401 }),
    );
  });

  it('should call next with error for expired token', () => {
    const token = jwt.sign(
      { id: 1, email: 'test@test.com', username: 'testuser', role: 'student' },
      JWT_SECRET,
      { expiresIn: '0s' },
    );
    const { req, res, next } = createMockReqRes({
      authorization: `Bearer ${token}`,
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Token expired', statusCode: 401 }),
    );
  });
});

describe('authorize middleware', () => {
  it('should call next() when user has correct role', () => {
    const { req, res, next } = createMockReqRes();
    (req as any).user = { id: 1, email: 'test@test.com', username: 'testuser', role: 'admin' };

    const middleware = authorize('admin', 'teacher');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should return 403 when user does not have required role', () => {
    const { req, res, next } = createMockReqRes();
    (req as any).user = { id: 1, email: 'test@test.com', username: 'testuser', role: 'student' };

    const middleware = authorize('admin');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Insufficient permissions',
        statusCode: 403,
      }),
    );
  });

  it('should return 401 when no user on request', () => {
    const { req, res, next } = createMockReqRes();

    const middleware = authorize('admin');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it('should allow any role when no specific roles are passed', () => {
    const { req, res, next } = createMockReqRes();
    (req as any).user = { id: 1, email: 'test@test.com', username: 'testuser', role: 'student' };

    const middleware = authorize();
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
