import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { ROLES } from '../../utils/constants';
import * as aiController from './ai.controller';
import { generateMatchingDistractorSchema } from './ai.validation';

const router = Router();

router.use(authenticate);

// ── Teacher/Admin: matching distractor generation ──────
router.post(
  '/matching-distractor',
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(generateMatchingDistractorSchema),
  aiController.generateMatchingDistractor,
);

export default router;
