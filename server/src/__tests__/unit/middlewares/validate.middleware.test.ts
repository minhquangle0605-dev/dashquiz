import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../../middlewares/validate';

function createMockReqRes(body: unknown = {}, query: unknown = {}) {
  const req = { body, query } as Request;
  const res = {} as Response;
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  return { req, res, next };
}

const testSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

describe('validate middleware', () => {
  it('should call next() with valid body', () => {
    const { req, res, next } = createMockReqRes({
      email: 'test@test.com',
      password: 'password123',
    });

    const middleware = validate(testSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'test@test.com', password: 'password123' });
  });

  it('should call next with error on invalid email', () => {
    const { req, res, next } = createMockReqRes({
      email: 'invalid-email',
      password: 'password123',
    });

    const middleware = validate(testSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Validation failed',
        statusCode: 400,
      }),
    );
  });

  it('should call next with error on missing required field', () => {
    const { req, res, next } = createMockReqRes({
      email: 'test@test.com',
    });

    const middleware = validate(testSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
      }),
    );
  });

  it('should call next with error for password too short', () => {
    const { req, res, next } = createMockReqRes({
      email: 'test@test.com',
      password: '123',
    });

    const middleware = validate(testSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'password' }),
        ]),
      }),
    );
  });

  it('should validate query source when specified', () => {
    const querySchema = z.object({
      page: z.coerce.number().min(1),
    });

    const { req, res, next } = createMockReqRes({}, { page: '1' });

    const middleware = validate(querySchema, 'query');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
