import type { Request, Response, NextFunction } from 'express';

import { notificationService } from './notification.service';
import { AppError } from '../../middlewares/errorHandler';
import type { ListNotificationsQuery } from './notification.validation';

export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const query = (req as Request & { validatedQuery?: ListNotificationsQuery }).validatedQuery ?? {
      page: 1,
      limit: 20,
      isRead: 'all' as const,
    };

    const result = await notificationService.listNotifications(userId, query);

    res.json({
      success: true,
      message: 'Notifications retrieved',
      data: result.data,
      unreadCount: result.unreadCount,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const notificationId = parseInt(req.params.id, 10);

    if (isNaN(notificationId)) {
      throw new AppError('Invalid notification ID', 400);
    }

    const data = await notificationService.markAsRead(userId, notificationId);

    res.json({
      success: true,
      message: 'Notification marked as read',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const data = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function subscribePush(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { endpoint, keys } = req.body;

    const data = await notificationService.subscribePush(userId, { endpoint, keys });

    res.status(data.updated ? 200 : 201).json({
      success: true,
      message: data.updated ? 'Push subscription updated' : 'Push subscription created',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function unsubscribePush(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { endpoint } = req.body;

    const data = await notificationService.unsubscribePush(userId, endpoint);

    res.json({
      success: true,
      message: data.removed ? 'Push subscription removed' : 'Subscription not found',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
