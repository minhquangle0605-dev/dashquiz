import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { ROLES } from '../../utils/constants';
import * as aiController from './ai.controller';
import {
  generateRemedialSchema,
  submitRemedialAnswerSchema,
  generateMatchingDistractorSchema,
} from './ai.validation';

const router = Router();

router.use(authenticate);

// ── Teacher/Admin: matching distractor generation ──────
router.post(
  '/matching-distractor',
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(generateMatchingDistractorSchema),
  aiController.generateMatchingDistractor,
);

// ── Student-only AI features ───────────────────────────
router.post('/practice/start', authorize(ROLES.STUDENT), aiController.startPractice);

router.post(
  '/remedial-practice',
  authorize(ROLES.STUDENT),
  validate(generateRemedialSchema),
  aiController.generateRemedial,
);

router.get(
  '/remedial-sessions/:id',
  authorize(ROLES.STUDENT),
  aiController.getRemedialSession,
);

router.post(
  '/remedial-sessions/:id/questions/:questionId/answer',
  authorize(ROLES.STUDENT),
  validate(submitRemedialAnswerSchema),
  aiController.submitRemedialAnswer,
);

export default router;
