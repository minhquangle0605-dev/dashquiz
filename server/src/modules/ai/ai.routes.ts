import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { ROLES } from '../../utils/constants';
import * as aiController from './ai.controller';

const router = Router();

router.post(
  '/practice/start',
  authenticate,
  authorize(ROLES.STUDENT),
  aiController.startPractice,
);

export default router;
