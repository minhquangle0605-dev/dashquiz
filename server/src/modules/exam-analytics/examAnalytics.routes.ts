import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { ROLES } from '../../utils/constants';
import * as controller from './examAnalytics.controller';

// ════════════════════════════════════════════════════════════════════
// Exam analytics router (Advanced Reporting upgrade).
// Mounted at /api/teacher in app.ts → /api/teacher/exams/:id/analytics/*
// Teacher/admin only; per-exam ownership is enforced in the service layer.
// ════════════════════════════════════════════════════════════════════

export const examAnalyticsRouter = Router();

const guard = [authenticate, authorize(ROLES.TEACHER, ROLES.ADMIN)] as const;

examAnalyticsRouter.get('/exams/:id/analytics/summary', ...guard, controller.getSummary);
examAnalyticsRouter.get('/exams/:id/analytics/questions', ...guard, controller.getQuestions);
examAnalyticsRouter.get('/exams/:id/analytics/topics', ...guard, controller.getTopics);
examAnalyticsRouter.get('/exams/:id/analytics/students', ...guard, controller.getStudents);
examAnalyticsRouter.get('/exams/:id/analytics/status', ...guard, controller.getStatus);
examAnalyticsRouter.post('/exams/:id/analytics/recalculate', ...guard, controller.recalculate);
