import { Request, Response, NextFunction } from 'express';

/**
 * Request validation middleware — placeholder for Zod integration in Phase 2
 * Will accept a Zod schema and validate req.body
 */
export const validate = (_schema: unknown) => {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // TODO: Phase 2 — implement Zod validation
    // const result = schema.safeParse(req.body);
    // if (!result.success) {
    //   throw new AppError('Validation failed', 400);
    // }
    next();
  };
};
