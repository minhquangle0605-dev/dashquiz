import { Router } from 'express';
import * as curriculumController from './curriculum.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import { createChapterSchema, createTopicSchema } from './curriculum.validation';
import { ROLES } from '../../utils/constants';

const router = Router();

// ═══════════════════════════════════════════════
// PUBLIC CURRICULUM (authenticated users)
// ═══════════════════════════════════════════════

// GET /api/subjects — list active subjects
router.get(
  '/subjects',
  authenticate,
  curriculumController.listSubjects,
);

// GET /api/subjects/:id/chapters — chapters by subject
router.get(
  '/subjects/:id/chapters',
  authenticate,
  curriculumController.getChaptersBySubject,
);

// GET /api/chapters/:id/topics — topics by chapter
router.get(
  '/chapters/:id/topics',
  authenticate,
  curriculumController.getTopicsByChapter,
);

// GET /api/topics/:id/relations — Knowledge Graph edges
router.get(
  '/topics/:id/relations',
  authenticate,
  curriculumController.getTopicRelations,
);

// ═══════════════════════════════════════════════
// TEACHER-ONLY CREATION ENDPOINTS
// ═══════════════════════════════════════════════

// POST /api/chapters — create chapter
router.post(
  '/chapters',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(createChapterSchema),
  activityLogger('CREATE_CHAPTER', 'chapter'),
  curriculumController.createChapter,
);

// POST /api/topics — create topic
router.post(
  '/topics',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(createTopicSchema),
  activityLogger('CREATE_TOPIC', 'topic'),
  curriculumController.createTopic,
);

export default router;
