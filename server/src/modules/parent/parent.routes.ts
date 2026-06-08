import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { ROLES } from '../../utils/constants';
import * as parentController from './parent.controller';
import {
  childResultsQuerySchema,
  childAnalyticsQuerySchema,
  childLearningPathQuerySchema,
} from './parent.validation';

const router = Router();

// In dual-login mode all parent endpoints are auto-scoped to the JWT's studentId.
// There is no link-student / generate-link-code flow anymore — the parent is
// inherently the holder of the student record's parentPasswordHash.

router.get(
  '/children',
  authenticate,
  authorize(ROLES.PARENT),
  parentController.getChildren,
);

router.get(
  '/children/:id/results',
  authenticate,
  authorize(ROLES.PARENT),
  validate(childResultsQuerySchema, 'query'),
  parentController.getChildResults,
);

router.get(
  '/children/:id/dashboard',
  authenticate,
  authorize(ROLES.PARENT),
  validate(childAnalyticsQuerySchema, 'query'),
  parentController.getChildDashboard,
);

router.get(
  '/children/:id/knowledge-graph',
  authenticate,
  authorize(ROLES.PARENT),
  validate(childAnalyticsQuerySchema, 'query'),
  parentController.getChildKnowledgeGraph,
);

router.get(
  '/children/:id/knowledge-graph/path',
  authenticate,
  authorize(ROLES.PARENT),
  validate(childLearningPathQuerySchema, 'query'),
  parentController.getChildLearningPath,
);

export default router;
