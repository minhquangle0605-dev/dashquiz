import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export const activityLogger = (action: string, entityType: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userId = req.user?.id ?? null;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    prisma.activityLog
      .create({
        data: {
          userId,
          action,
          entityType,
          ipAddress: ip,
        },
      })
      .catch((err: Error) => {
        logger.error('Failed to write activity log:', err);
      });

    next();
  };
};
