import { Router } from 'express';
import * as examController from './exam.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import {
  createExamSchema,
  updateExamSchema,
  addQuestionsSchema,
  scheduleExamSchema,
  assignExamSchema,
  listExamsQuerySchema,
  examMonitoringQuerySchema,
} from './exam.validation';
import { ROLES } from '../../utils/constants';

const router = Router();

// ── List exams (GET /api/exams) ──────────────────
router.get(
  '/',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(listExamsQuerySchema, 'query'),
  examController.listExams,
);

// ── Get exam detail (GET /api/exams/:id) ─────────
router.get(
  '/:id',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  examController.getExam,
);

// ── Create exam (POST /api/exams) ────────────────
router.post(
  '/',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(createExamSchema),
  activityLogger('CREATE_EXAM', 'exam'),
  examController.createExam,
);

// ── Update exam (PUT /api/exams/:id) ─────────────
router.put(
  '/:id',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(updateExamSchema),
  activityLogger('UPDATE_EXAM', 'exam'),
  examController.updateExam,
);

// ── Delete exam (DELETE /api/exams/:id) ──────────
router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('DELETE_EXAM', 'exam'),
  examController.deleteExam,
);

// ── Add questions (POST /api/exams/:id/questions) ─
router.post(
  '/:id/questions',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(addQuestionsSchema),
  activityLogger('ADD_EXAM_QUESTIONS', 'exam'),
  examController.addQuestions,
);

// ── Publish exam (PUT /api/exams/:id/publish) ────
router.put(
  '/:id/publish',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('PUBLISH_EXAM', 'exam'),
  examController.publishExam,
);

// ── Schedule exam (POST /api/exams/:id/schedule) ─
router.post(
  '/:id/schedule',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(scheduleExamSchema),
  activityLogger('SCHEDULE_EXAM', 'exam'),
  examController.scheduleExam,
);

// ── Assign exam (POST /api/exams/:id/assign) ─────
router.post(
  '/:id/assign',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(assignExamSchema),
  activityLogger('ASSIGN_EXAM', 'exam'),
  examController.assignExam,
);

// ── Get assignments (GET /api/exams/:id/assignments)
router.get(
  '/:id/assignments',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  examController.getAssignments,
);

// ── Teacher monitoring dashboard for an assigned exam
router.get(
  '/:id/monitoring',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(examMonitoringQuerySchema, 'query'),
  examController.getMonitoring,
);

export default router;
