import { Router } from 'express';

import * as notificationController from './notification.controller';

const router = Router();

router.get('/', notificationController.listNotifications);

export default router;
