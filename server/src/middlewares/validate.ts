import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from './errorHandler';

export const validate = (schema: z.ZodType, source: 'body' | 'query' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = source === 'query' ? req.query : req.body;
      const result = schema.safeParse(data);
      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        const error = new AppError('Validation failed', 400);
        error.errors = errors;
        next(error);
        return;
      }

      if (source === 'query') {
        (req as Request & { validatedQuery: unknown }).validatedQuery = result.data;
      } else {
        req.body = result.data;
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new AppError('Validation failed', 400));
        return;
      }
      next(error);
    }
  };
};
