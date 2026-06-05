import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { ROLES } from '../../utils/constants';
import * as controller from './questionQuality.controller';
import { reviewStatusSchema } from './questionQuality.controller';

// Question quality + review workflow. Mounted at /api/questions in app.ts.
// → GET /api/questions/:id/quality   PUT /api/questions/:id/review-status
export const questionQualityRouter = Router();

const guard = [authenticate, authorize(ROLES.TEACHER, ROLES.ADMIN)] as const;

questionQualityRouter.get('/:id/quality', ...guard, controller.getQuality);
questionQualityRouter.put(
  '/:id/review-status',
  ...guard,
  validate(reviewStatusSchema),
  controller.setReviewStatus,
);
