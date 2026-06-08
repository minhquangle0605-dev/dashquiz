import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { ROLES } from '../../utils/constants';
import * as controller from './knowledgeGraph.controller';
import {
  subjectQuerySchema,
  updateNodeBodySchema,
  learningPathQuerySchema,
  listRelationsQuerySchema,
  createRelationBodySchema,
  addAliasBodySchema,
  mergeNodeBodySchema,
  practiceBodySchema,
} from './knowledgeGraph.validation';

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

studentKnowledgeGraphRouter.get(
  '/knowledge-graph/path',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(learningPathQuerySchema, 'query'),
  controller.getMyLearningPath,
);

studentKnowledgeGraphRouter.post(
  '/knowledge-graph/practice',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(practiceBodySchema, 'body'),
  controller.generateMyPractice,
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

teacherKnowledgeGraphRouter.post(
  '/classes/:classId/knowledge-graph/practice',
  authenticate,
  authorize(ROLES.TEACHER),
  validate(practiceBodySchema, 'body'),
  controller.assignClassPractice,
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

// Relations (Package B). Declared before "/:id" so the literal path wins.
adminKnowledgeGraphRouter.get(
  '/relations',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(listRelationsQuerySchema, 'query'),
  controller.listRelations,
);

adminKnowledgeGraphRouter.post(
  '/relations',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createRelationBodySchema, 'body'),
  controller.createRelation,
);

adminKnowledgeGraphRouter.post(
  '/relations/seed-part-of',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.seedPartOfRelations,
);

adminKnowledgeGraphRouter.delete(
  '/relations/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.deleteRelation,
);

// Governance (Package C). Literal paths declared before "/:id".
adminKnowledgeGraphRouter.get(
  '/quality',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.getQualityReport,
);

adminKnowledgeGraphRouter.delete(
  '/aliases/:aliasId',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.deleteNodeAlias,
);

adminKnowledgeGraphRouter.get(
  '/:id/aliases',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.listNodeAliases,
);

adminKnowledgeGraphRouter.post(
  '/:id/aliases',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(addAliasBodySchema, 'body'),
  controller.addNodeAlias,
);

adminKnowledgeGraphRouter.post(
  '/:id/merge',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(mergeNodeBodySchema, 'body'),
  controller.mergeNode,
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
