import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import { authenticate } from '../../middlewares/auth';
import { loginSchema, refreshTokenSchema } from './auth.validation';

const router = Router();

router.post(
  '/login',
  validate(loginSchema),
  activityLogger('LOGIN', 'auth'),
  authController.login,
);

router.post(
  '/logout',
  authenticate,
  activityLogger('LOGOUT', 'auth'),
  authController.logout,
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  authController.refresh,
);

export default router;
