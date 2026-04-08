import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Simple in-memory rate limiter — placeholder
 * Will be replaced with express-rate-limit + Redis store in Phase 2
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      logger.warn(`Rate limit exceeded for ${key}`);
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    record.count++;
    next();
  };
};
