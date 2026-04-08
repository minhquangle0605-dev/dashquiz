import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * JWT authentication middleware — placeholder for Phase 2
 * Will verify JWT token from Authorization header
 */
export const authenticate = (_req: Request, _res: Response, next: NextFunction): void => {
  // TODO: Phase 2 — implement JWT verification
  // const token = req.headers.authorization?.split(' ')[1];
  // if (!token) throw new AppError('Authentication required', 401);
  // const payload = jwt.verify(token, env.jwt.secret);
  // req.user = payload;
  next();
};

/**
 * Role-based authorization middleware — placeholder for Phase 2
 */
export const authorize = (..._roles: string[]) => {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // TODO: Phase 2 — check req.user.role against allowed roles
    // if (!roles.includes(req.user?.role)) {
    //   throw new AppError('Insufficient permissions', 403);
    // }
    next();
  };
};
