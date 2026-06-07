import { Router } from 'express';
import * as curriculumController from './curriculum.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import { createChapterSchema } from './curriculum.validation';
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

export default router;
