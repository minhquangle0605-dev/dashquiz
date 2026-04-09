import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { ROLES } from '../../utils/constants';
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
  authorize(ROLES.STUDENT),
  validate(studentDashboardQuerySchema, 'query'),
  analyticsController.getStudentDashboard,
);

studentAnalyticsRouter.get(
  '/analytics/strengths',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(studentStrengthsQuerySchema, 'query'),
  analyticsController.getStudentStrengths,
);

studentAnalyticsRouter.get(
  '/analytics/time',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(studentTimeAnalysisQuerySchema, 'query'),
  analyticsController.getStudentTimeAnalysis,
);

studentAnalyticsRouter.get(
  '/analytics/patterns',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(studentPatternsQuerySchema, 'query'),
  analyticsController.getStudentPatterns,
);

studentAnalyticsRouter.get(
  '/analytics/knowledge-graph',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(studentKnowledgeGraphQuerySchema, 'query'),
  analyticsController.getStudentKnowledgeGraph,
);

studentAnalyticsRouter.get(
  '/analytics/attempts',
  authenticate,
  authorize(ROLES.STUDENT),
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
  authorize(ROLES.TEACHER),
  analyticsController.getClassDashboard,
);

teacherAnalyticsRouter.get(
  '/classes/:id/analytics/performance',
  authenticate,
  authorize(ROLES.TEACHER),
  validate(classPerformanceQuerySchema, 'query'),
  analyticsController.getClassPerformance,
);

teacherAnalyticsRouter.get(
  '/exams/:id/analytics/distribution',
  authenticate,
  authorize(ROLES.TEACHER),
  analyticsController.getExamDistribution,
);

teacherAnalyticsRouter.get(
  '/classes/:id/analytics/weak-students',
  authenticate,
  authorize(ROLES.TEACHER),
  validate(weakStudentsQuerySchema, 'query'),
  analyticsController.getWeakStudents,
);

teacherAnalyticsRouter.get(
  '/analytics/compare-classes',
  authenticate,
  authorize(ROLES.TEACHER),
  validate(compareClassesQuerySchema, 'query'),
  analyticsController.compareClasses,
);

teacherAnalyticsRouter.get(
  '/exams/:id/results',
  authenticate,
  authorize(ROLES.TEACHER),
  validate(examResultsQuerySchema, 'query'),
  analyticsController.getExamResults,
);

teacherAnalyticsRouter.post(
  '/reports/export',
  authenticate,
  authorize(ROLES.TEACHER),
  validate(exportReportBodySchema, 'body'),
  analyticsController.exportReport,
);
