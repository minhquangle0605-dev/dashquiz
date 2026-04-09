import { Router } from 'express';
import * as studentExamController from './studentExam.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import {
  listStudentExamsQuerySchema,
  saveAnswersSchema,
  submitAttemptSchema,
  listAttemptsQuerySchema,
} from './studentExam.validation';
import { ROLES } from '../../utils/constants';

const router = Router();

// All student-exam routes require authentication + student role
router.use(authenticate);
router.use(authorize(ROLES.STUDENT));

// ── List assigned exams (GET /api/student/exams) ────────
router.get(
  '/exams',
  validate(listStudentExamsQuerySchema, 'query'),
  studentExamController.listStudentExams,
);

// ── Start exam (POST /api/student/exams/:id/start) ──────
router.post(
  '/exams/:id/start',
  activityLogger('START_EXAM', 'exam_attempt'),
  studentExamController.startExam,
);

// ── Auto-save answers (PUT /api/student/attempts/:id/save)
router.put(
  '/attempts/:id/save',
  validate(saveAnswersSchema),
  studentExamController.saveAnswers,
);

// ── Submit attempt (POST /api/student/attempts/:id/submit)
router.post(
  '/attempts/:id/submit',
  validate(submitAttemptSchema),
  activityLogger('SUBMIT_EXAM', 'exam_attempt'),
  studentExamController.submitAttempt,
);

// ── Get result (GET /api/student/attempts/:id/result) ───
router.get(
  '/attempts/:id/result',
  studentExamController.getAttemptResult,
);

// ── List all attempts (GET /api/student/attempts) ────────
router.get(
  '/attempts',
  validate(listAttemptsQuerySchema, 'query'),
  studentExamController.listAttempts,
);

export default router;
