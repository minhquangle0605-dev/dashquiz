import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export const rateLimiter = (maxRequests: number, windowMs: number) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `rl:${req.path}:${req.ip || 'unknown'}`;
    const windowSec = Math.ceil(windowMs / 1000);

    try {
      const redis = getRedisClient();
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSec);
      }

      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + ttl);

      if (current > maxRequests) {
        logger.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          errors: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.warn('Rate limiter Redis error, allowing request:', error);
      next();
    }
  };
};
