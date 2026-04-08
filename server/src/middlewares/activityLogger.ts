import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Activity logging middleware — logs user actions for audit trail
 * Will write to activity_logs table in Phase 2+
 */
export const activityLogger = (action: string, entityType: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userId = req.user?.id || 'anonymous';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    logger.info(`Activity: ${action}`, {
      userId,
      action,
      entityType,
      ip,
      method: req.method,
      path: req.path,
    });

    // TODO: Phase 2+ — save to database
    // await prisma.activityLog.create({ ... });

    next();
  };
};
