import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import * as analyticsController from './analytics.controller';
import {
  studentDashboardQuerySchema,
  studentStrengthsQuerySchema,
  studentTimeAnalysisQuerySchema,
  studentPatternsQuerySchema,
  studentKnowledgeGraphQuerySchema,
  studentAttemptsQuerySchema,
  classPerformanceQuerySchema,
  weakStudentsQuerySchema,
  compareClassesQuerySchema,
  examResultsQuerySchema,
  exportReportBodySchema,
} from './analytics.validation';

// ═══════════════════════════════════════════════════
// STUDENT ANALYTICS ROUTER
// Mounted at /api/student in app.ts (alongside student-exam routes)
// ═══════════════════════════════════════════════════

export const studentAnalyticsRouter = Router();

studentAnalyticsRouter.get(
  '/dashboard',
  authenticate,
  authorize('Student'),
  validate(studentDashboardQuerySchema, 'query'),
  analyticsController.getStudentDashboard,
);

studentAnalyticsRouter.get(
  '/analytics/strengths',
  authenticate,
  authorize('Student'),
  validate(studentStrengthsQuerySchema, 'query'),
  analyticsController.getStudentStrengths,
);

studentAnalyticsRouter.get(
  '/analytics/time',
  authenticate,
  authorize('Student'),
  validate(studentTimeAnalysisQuerySchema, 'query'),
  analyticsController.getStudentTimeAnalysis,
);

studentAnalyticsRouter.get(
  '/analytics/patterns',
  authenticate,
  authorize('Student'),
  validate(studentPatternsQuerySchema, 'query'),
  analyticsController.getStudentPatterns,
);

studentAnalyticsRouter.get(
  '/analytics/knowledge-graph',
  authenticate,
  authorize('Student'),
  validate(studentKnowledgeGraphQuerySchema, 'query'),
  analyticsController.getStudentKnowledgeGraph,
);

studentAnalyticsRouter.get(
  '/analytics/attempts',
  authenticate,
  authorize('Student'),
  validate(studentAttemptsQuerySchema, 'query'),
  analyticsController.getStudentAttempts,
);

// ═══════════════════════════════════════════════════
// TEACHER ANALYTICS ROUTER
// Mounted at /api/teacher in app.ts
// ═══════════════════════════════════════════════════

export const teacherAnalyticsRouter = Router();

teacherAnalyticsRouter.get(
  '/classes/:id/dashboard',
  authenticate,
  authorize('Teacher'),
  analyticsController.getClassDashboard,
);

teacherAnalyticsRouter.get(
  '/classes/:id/analytics/performance',
  authenticate,
  authorize('Teacher'),
  validate(classPerformanceQuerySchema, 'query'),
  analyticsController.getClassPerformance,
);

teacherAnalyticsRouter.get(
  '/exams/:id/analytics/distribution',
  authenticate,
  authorize('Teacher'),
  analyticsController.getExamDistribution,
);

teacherAnalyticsRouter.get(
  '/classes/:id/analytics/weak-students',
  authenticate,
  authorize('Teacher'),
  validate(weakStudentsQuerySchema, 'query'),
  analyticsController.getWeakStudents,
);

teacherAnalyticsRouter.get(
  '/analytics/compare-classes',
  authenticate,
  authorize('Teacher'),
  validate(compareClassesQuerySchema, 'query'),
  analyticsController.compareClasses,
);

teacherAnalyticsRouter.get(
  '/exams/:id/results',
  authenticate,
  authorize('Teacher'),
  validate(examResultsQuerySchema, 'query'),
  analyticsController.getExamResults,
);

teacherAnalyticsRouter.post(
  '/reports/export',
  authenticate,
  authorize('Teacher'),
  validate(exportReportBodySchema, 'body'),
  analyticsController.exportReport,
);

// Default export for backward compatibility
const router = Router();
router.use('/student', studentAnalyticsRouter);
router.use('/teacher', teacherAnalyticsRouter);
export default router;
