import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { ROLES } from '../../utils/constants';
import * as controller from './knowledgeGraph.controller';
import { subjectQuerySchema, updateNodeBodySchema } from './knowledgeGraph.validation';

// ═══════════════════════════════════════════════════
// STUDENT ROUTER — mounted at /api/student
// ═══════════════════════════════════════════════════
export const studentKnowledgeGraphRouter = Router();

studentKnowledgeGraphRouter.get(
  '/knowledge-graph',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(subjectQuerySchema, 'query'),
  controller.getMyGraph,
);

studentKnowledgeGraphRouter.get(
  '/knowledge-graph/recommendations',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(subjectQuerySchema, 'query'),
  controller.getMyRecommendations,
);

// ═══════════════════════════════════════════════════
// TEACHER ROUTER — mounted at /api/teacher
// ═══════════════════════════════════════════════════
export const teacherKnowledgeGraphRouter = Router();

teacherKnowledgeGraphRouter.get(
  '/students/:studentId/knowledge-graph',
  authenticate,
  authorize(ROLES.TEACHER),
  validate(subjectQuerySchema, 'query'),
  controller.getStudentGraphForTeacher,
);

teacherKnowledgeGraphRouter.get(
  '/classes/:classId/knowledge-graph',
  authenticate,
  authorize(ROLES.TEACHER),
  validate(subjectQuerySchema, 'query'),
  controller.getClassGraph,
);

teacherKnowledgeGraphRouter.get(
  '/classes/:classId/knowledge-graph/weak-nodes',
  authenticate,
  authorize(ROLES.TEACHER),
  validate(subjectQuerySchema, 'query'),
  controller.getClassWeakNodes,
);

// ═══════════════════════════════════════════════════
// ADMIN ROUTER — mounted at /api/admin/knowledge-nodes
// ═══════════════════════════════════════════════════
export const adminKnowledgeGraphRouter = Router();

adminKnowledgeGraphRouter.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(subjectQuerySchema, 'query'),
  controller.listNodes,
);

adminKnowledgeGraphRouter.post(
  '/autogenerate',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.autogenerate,
);

adminKnowledgeGraphRouter.post(
  '/recalculate',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.recalculateAll,
);

adminKnowledgeGraphRouter.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(updateNodeBodySchema, 'body'),
  controller.updateNode,
);

adminKnowledgeGraphRouter.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.deleteNode,
);
