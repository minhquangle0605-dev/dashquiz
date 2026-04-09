import type { Request, Response, NextFunction } from 'express';

import { notificationService } from './notification.service';

export async function listNotifications(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await notificationService.listNotifications();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
