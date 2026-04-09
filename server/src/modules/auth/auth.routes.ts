import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middlewares/validate';
import { rateLimiter } from '../../middlewares/rateLimiter';
import { activityLogger } from '../../middlewares/activityLogger';
import { authenticate } from '../../middlewares/auth';
import {
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation';
import { RATE_LIMIT } from '../../utils/constants';

const router = Router();

router.post(
  '/login',
  rateLimiter(RATE_LIMIT.LOGIN_MAX, RATE_LIMIT.LOGIN_WINDOW_MS),
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

router.post(
  '/forgot-password',
  rateLimiter(3, 15 * 60 * 1000),
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  activityLogger('RESET_PASSWORD', 'auth'),
  authController.resetPassword,
);

export default router;
