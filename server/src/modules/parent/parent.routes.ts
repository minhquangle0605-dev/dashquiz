import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import * as parentController from './parent.controller';
import {
  linkStudentBodySchema,
  childResultsQuerySchema,
  childAnalyticsQuerySchema,
} from './parent.validation';

const router = Router();

// POST /api/parent/link-student — Link child by code
router.post(
  '/link-student',
  authenticate,
  authorize('Parent'),
  validate(linkStudentBodySchema, 'body'),
  parentController.linkStudent,
);

// GET /api/parent/children — List linked children
router.get(
  '/children',
  authenticate,
  authorize('Parent'),
  parentController.getChildren,
);

// GET /api/parent/children/:id/results — Child exam results
router.get(
  '/children/:id/results',
  authenticate,
  authorize('Parent'),
  validate(childResultsQuerySchema, 'query'),
  parentController.getChildResults,
);

// GET /api/parent/children/:id/dashboard — Child dashboard
router.get(
  '/children/:id/dashboard',
  authenticate,
  authorize('Parent'),
  validate(childAnalyticsQuerySchema, 'query'),
  parentController.getChildDashboard,
);

// GET /api/parent/children/:id/analytics/strengths — Child strengths
router.get(
  '/children/:id/analytics/strengths',
  authenticate,
  authorize('Parent'),
  validate(childAnalyticsQuerySchema, 'query'),
  parentController.getChildStrengths,
);

// POST /api/parent/generate-link-code/:studentId — Admin generates code for student
router.post(
  '/generate-link-code/:studentId',
  authenticate,
  authorize('Admin'),
  parentController.generateLinkCode,
);

export default router;
