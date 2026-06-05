import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { rateLimiter } from './middlewares/rateLimiter';
import { getDatabaseStatus } from './config/database';
import { getRedisStatus } from './config/redis';
import { getMinioStatus } from './config/minio';
import { RATE_LIMIT } from './utils/constants';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import adminUserRoutes from './modules/user/user.admin.routes';
import examRoutes from './modules/exam/exam.routes';
import questionRoutes from './modules/question/question.routes';
import { studentAnalyticsRouter, teacherAnalyticsRouter } from './modules/analytics/analytics.routes';
import { examAnalyticsRouter } from './modules/exam-analytics/examAnalytics.routes';
import { questionQualityRouter } from './modules/exam-analytics/questionQuality.routes';
import { adminAnalyticsRouter } from './modules/exam-analytics/adminAnalytics.routes';
import aiRoutes from './modules/ai/ai.routes';
import notificationRoutes from './modules/notification/notification.routes';
import classRoutes from './modules/class/class.routes';
import academicRoutes from './modules/academic/academic.routes';
import systemRoutes from './modules/system/system.routes';
import curriculumRoutes from './modules/curriculum/curriculum.routes';
import parentRoutes from './modules/parent/parent.routes';
import studentExamRoutes from './modules/student-exam/studentExam.routes';
import discussionRoutes from './modules/discussion/discussion.routes';
import timetableRoutes from './modules/timetable/timetable.routes';

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
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Global API rate limiter (all /api/* routes)
app.use('/api', rateLimiter(RATE_LIMIT.API_MAX, RATE_LIMIT.API_WINDOW_MS));

// ── Health Check (with dependency status) ───────
app.get('/health', async (_req, res) => {
  const [db, redis, minio] = await Promise.all([
    getDatabaseStatus(),
    getRedisStatus(),
    getMinioStatus(),
  ]);

  const healthy = db.connected;
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'WebQuiz API is running' : 'Service degraded',
    data: {
      environment: env.nodeEnv,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
      services: { database: db, redis, minio },
    },
  });
});

// ── API Routes ──────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/questions', questionQualityRouter);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/academic', academicRoutes);
app.use('/api/admin/system', systemRoutes);
app.use('/api/admin', adminAnalyticsRouter);
app.use('/api/parent', parentRoutes);
app.use('/api/student', studentExamRoutes);
app.use('/api/student', studentAnalyticsRouter);
app.use('/api/teacher', teacherAnalyticsRouter);
app.use('/api/teacher', examAnalyticsRouter);
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
          curriculum: '/api/subjects/*, /api/chapters/*, /api/topics/*',
          ai: '/api/ai/*',
          notifications: '/api/notifications/*',
          parent: '/api/parent/*',
          classes: '/api/classes/*',
          discussions: '/api/discussions/*',
          timetable: '/api/timetable/*',
          adminUsers: '/api/admin/users/*',
          adminAcademic: '/api/admin/academic/*',
          adminSystem: '/api/admin/system/*',
          studentExams: '/api/student/exams/*, /api/student/attempts/*',
          studentAnalytics: '/api/student/dashboard, /api/student/analytics/*',
          teacherAnalytics: '/api/teacher/classes/*, /api/teacher/exams/*, /api/teacher/reports/*',
        },
    },
  });
});

// ── Error Handling ──────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
