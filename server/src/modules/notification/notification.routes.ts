import { Router } from 'express';

import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import * as notificationController from './notification.controller';
import {
  listNotificationsQuerySchema,
  pushSubscribeBodySchema,
  pushUnsubscribeBodySchema,
} from './notification.validation';

const router = Router();

// GET /api/notifications — list notifications (paginated, filter is_read)
router.get(
  '/',
  authenticate,
  validate(listNotificationsQuerySchema, 'query'),
  notificationController.listNotifications,
);

// PUT /api/notifications/:id/read — mark single as read
router.put(
  '/:id/read',
  authenticate,
  notificationController.markAsRead,
);

// PUT /api/notifications/read-all — mark all as read
router.put(
  '/read-all',
  authenticate,
  notificationController.markAllAsRead,
);

// POST /api/push/subscribe — register push notification
router.post(
  '/push/subscribe',
  authenticate,
  validate(pushSubscribeBodySchema, 'body'),
  notificationController.subscribePush,
);

// DELETE /api/push/unsubscribe — unregister push notification
router.delete(
  '/push/unsubscribe',
  authenticate,
  validate(pushUnsubscribeBodySchema, 'body'),
  notificationController.unsubscribePush,
);

export default router;
