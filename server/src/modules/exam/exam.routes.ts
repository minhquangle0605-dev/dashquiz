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
  examSecuritySettingsSchema,
  proctorReviewSchema,
  gradeAnswerSchema,
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

router.get(
  '/:id/proctoring/live',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(examMonitoringQuerySchema, 'query'),
  examController.getMonitoring,
);

router.get(
  '/:id/security-settings',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  examController.getSecuritySettings,
);

router.put(
  '/:id/security-settings',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(examSecuritySettingsSchema),
  activityLogger('UPDATE_EXAM_SECURITY_SETTINGS', 'exam'),
  examController.updateSecuritySettings,
);

router.get(
  '/:id/attempts/:attemptId/evidence',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  examController.getEvidenceReport,
);

router.put(
  '/:id/attempts/:attemptId/review',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(proctorReviewSchema),
  activityLogger('REVIEW_EXAM_ATTEMPT_SECURITY', 'exam_attempt'),
  examController.saveProctorReview,
);

// ── Reports (Grades / Responses / Statistics / Manual grading) ──
router.get(
  '/:id/reports',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  examController.getReport,
);

// ── Manual grade one answer of an attempt ──
router.put(
  '/:id/attempts/:attemptId/answers/:answerId/grade',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(gradeAnswerSchema),
  activityLogger('GRADE_EXAM_ANSWER', 'exam_attempt'),
  examController.gradeAnswer,
);

// ── Delete an attempt ──
router.delete(
  '/:id/attempts/:attemptId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('DELETE_EXAM_ATTEMPT', 'exam_attempt'),
  examController.deleteAttempt,
);

export default router;
