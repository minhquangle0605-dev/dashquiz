import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import adminUserRoutes from './modules/user/user.admin.routes';
import examRoutes from './modules/exam/exam.routes';
import questionRoutes from './modules/question/question.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import { studentAnalyticsRouter, teacherAnalyticsRouter } from './modules/analytics/analytics.routes';
import aiRoutes from './modules/ai/ai.routes';
import notificationRoutes from './modules/notification/notification.routes';
import classRoutes from './modules/class/class.routes';
import academicRoutes from './modules/academic/academic.routes';
import systemRoutes from './modules/system/system.routes';
import curriculumRoutes from './modules/curriculum/curriculum.routes';
import parentRoutes from './modules/parent/parent.routes';
import studentExamRoutes from './modules/student-exam/studentExam.routes';

const app = express();

// ── Security & Utility Middlewares ──────────────
app.use(helmet());
app.use(cors({
  origin: env.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ── Health Check ────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'WebQuiz API is running',
    data: {
      environment: env.nodeEnv,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
    },
  });
});

// ── API Routes ──────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/academic', academicRoutes);
app.use('/api/admin/system', systemRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/student', studentExamRoutes);
app.use('/api/student', studentAnalyticsRouter);
app.use('/api/teacher', teacherAnalyticsRouter);
app.use('/api', curriculumRoutes);

// ── API Index ───────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({
    success: true,
    message: 'WebQuiz API v1.0',
    data: {
        endpoints: {
          health: 'GET /health',
          auth: '/api/auth/*',
          users: '/api/users/*',
          exams: '/api/exams/*',
          questions: '/api/questions/*',
          subjects: '/api/subjects/*',
          chapters: '/api/chapters/*',
          topics: '/api/topics/*',
          analytics: '/api/analytics/*',
          ai: '/api/ai/*',
          notifications: '/api/notifications/*',
          pushSubscribe: 'POST /api/notifications/push/subscribe',
          pushUnsubscribe: 'DELETE /api/notifications/push/unsubscribe',
          parentLinkStudent: 'POST /api/parent/link-student',
          parentChildren: 'GET /api/parent/children',
          parentChildResults: 'GET /api/parent/children/:id/results',
          parentChildDashboard: 'GET /api/parent/children/:id/dashboard',
          parentChildStrengths: 'GET /api/parent/children/:id/analytics/strengths',
          classes: '/api/classes/*',
          adminUsers: '/api/admin/users/*',
          studentExams: '/api/student/exams/*',
          studentAttempts: '/api/student/attempts/*',
          studentDashboard: '/api/student/dashboard',
          studentAnalytics: '/api/student/analytics/*',
          teacherClasses: '/api/teacher/classes/*',
          teacherExams: '/api/teacher/exams/*',
          teacherReports: '/api/teacher/reports/*',
          academic: '/api/admin/academic/*',
          system: '/api/admin/system/*',
        },
    },
  });
});

// ── Error Handling ──────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
