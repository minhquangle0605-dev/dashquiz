import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

import { prisma } from '../../config/database';
import { getRedisClient } from '../../config/redis';
import { getMinioClient } from '../../config/minio';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { cacheGet, cacheSet } from '../../utils/cache';
import { examAnalyticsService } from '../exam-analytics/examAnalytics.service';
import { AppError } from '../../middlewares/errorHandler';

const REPORTS_BUCKET = 'reports';

// ═══════════════════════════════════════════════════
// CACHE HELPERS
// ═══════════════════════════════════════════════════

function cacheKey(prefix: string, userId: number, extra = ''): string {
  return `analytics:${prefix}:${userId}${extra ? ':' + extra : ''}`;
}

export async function invalidateStudentCache(studentId: number): Promise<void> {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(`analytics:student:*:${studentId}*`);
    const dashKey = cacheKey('student:dashboard', studentId);
    const strengthsKey = cacheKey('student:strengths', studentId);
    const allKeys = [...new Set([...keys, dashKey, strengthsKey])];
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }
  } catch (err) {
    logger.warn('Redis cache invalidation failed:', err);
  }
}

// ═══════════════════════════════════════════════════
// STUDENT ANALYTICS (UC10–15)
// ═══════════════════════════════════════════════════

export class StudentAnalyticsService {
  /**
   * UC10 – Student Dashboard
   * Aggregation: total exams, avg score, recent results, trend 30/60/90d
   */
  async getDashboard(studentId: number, subjectId?: number) {
    const key = cacheKey('student:dashboard', studentId, subjectId?.toString());
    const cached = await cacheGet(key);
    if (cached) return cached;

    const whereAttempt: Prisma.ExamAttemptWhereInput = {
      studentId,
      status: 'SUBMITTED',
      ...(subjectId && { exam: { subjectId } }),
    };

    const [totalExams, scoreAgg, recentResults, trends] = await Promise.all([
      prisma.examAttempt.count({ where: whereAttempt }),

      prisma.examAttempt.aggregate({
        where: whereAttempt,
        _avg: { totalScore: true },
        _max: { totalScore: true },
        _min: { totalScore: true },
      }),

      prisma.examAttempt.findMany({
        where: whereAttempt,
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          totalScore: true,
          submittedAt: true,
          timeSpentSec: true,
          exam: { select: { id: true, title: true, subject: { select: { name: true } } } },
        },
      }),

      this.getTrends(studentId, subjectId),
    ]);

    const result = {
      totalExams,
      avgScore: scoreAgg._avg.totalScore ? Number(scoreAgg._avg.totalScore) : 0,
      maxScore: scoreAgg._max.totalScore ? Number(scoreAgg._max.totalScore) : 0,
      minScore: scoreAgg._min.totalScore ? Number(scoreAgg._min.totalScore) : 0,
      recentResults: recentResults.map((r) => ({
        id: r.id,
        examId: r.exam.id,
        examTitle: r.exam.title,
        subjectName: r.exam.subject.name,
        score: r.totalScore ? Number(r.totalScore) : 0,
        submittedAt: r.submittedAt,
        timeSpentSec: r.timeSpentSec,
      })),
      trends,
    };

    await cacheSet(key, result);
    return result;
  }

  private async getTrends(studentId: number, subjectId?: number) {
    const now = new Date();
    const periods = [30, 60, 90] as const;
    const trends: Record<string, { avgScore: number; examCount: number }> = {};

    for (const days of periods) {
      const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const where: Prisma.ExamAttemptWhereInput = {
        studentId,
        status: 'SUBMITTED',
        submittedAt: { gte: from },
        ...(subjectId && { exam: { subjectId } }),
      };

      const agg = await prisma.examAttempt.aggregate({
        where,
        _avg: { totalScore: true },
        _count: true,
      });

      trends[`${days}d`] = {
        avgScore: agg._avg.totalScore ? Number(agg._avg.totalScore) : 0,
        examCount: agg._count,
      };
    }

    return trends;
  }

  /**
   * UC13 – Answer Patterns
   * Answer changes, skipped, time distribution
   */
  async getPatterns(studentId: number, subjectId?: number) {
    const whereClause: Prisma.AttemptAnswerWhereInput = {
      attempt: { studentId, status: 'SUBMITTED' },
      ...(subjectId && { question: { subjectId } }),
    };

    const answers = await prisma.attemptAnswer.findMany({
      where: whereClause,
      select: {
        isCorrect: true,
        timeSpentSec: true,
        answerChanges: true,
        selectedOptionId: true,
      },
    });

    const totalAnswers = answers.length;
    const skipped = answers.filter((a) => a.selectedOptionId === null).length;
    const withChanges = answers.filter((a) => a.answerChanges > 0);
    const totalChanges = withChanges.reduce((s, a) => s + a.answerChanges, 0);
    const changedCorrect = withChanges.filter((a) => a.isCorrect).length;
    const changedWrong = withChanges.filter((a) => !a.isCorrect).length;

    const timeBuckets = { fast: 0, moderate: 0, slow: 0, verySlows: 0 };
    for (const a of answers) {
      if (!a.timeSpentSec) continue;
      if (a.timeSpentSec <= 15) timeBuckets.fast++;
      else if (a.timeSpentSec <= 45) timeBuckets.moderate++;
      else if (a.timeSpentSec <= 120) timeBuckets.slow++;
      else timeBuckets.verySlows++;
    }

    return {
      totalAnswers,
      skippedCount: skipped,
      skippedRate: totalAnswers > 0 ? Math.round((skipped / totalAnswers) * 10000) / 100 : 0,
      answerChanges: {
        totalChanges,
        questionsWithChanges: withChanges.length,
        changedToCorrect: changedCorrect,
        changedToWrong: changedWrong,
        changeRate: totalAnswers > 0 ? Math.round((withChanges.length / totalAnswers) * 10000) / 100 : 0,
      },
      timeDistribution: timeBuckets,
    };
  }

  /**
   * UC15 – Attempt History
   * Paginated list with filters for subject, date range
   */
  async getAttempts(
    studentId: number,
    opts: {
      page: number;
      limit: number;
      subjectId?: number;
      dateFrom?: string;
      dateTo?: string;
      sort: string;
      order: string;
    },
  ) {
    const where: Prisma.ExamAttemptWhereInput = {
      studentId,
      status: { in: ['SUBMITTED', 'GRADED'] },
      ...(opts.subjectId && { exam: { subjectId: opts.subjectId } }),
      ...(opts.dateFrom || opts.dateTo
        ? {
            submittedAt: {
              ...(opts.dateFrom && { gte: new Date(opts.dateFrom) }),
              ...(opts.dateTo && { lte: new Date(opts.dateTo) }),
            },
          }
        : {}),
    };

    const orderBy: Prisma.ExamAttemptOrderByWithRelationInput =
      opts.sort === 'score' ? { totalScore: opts.order as 'asc' | 'desc' } : { submittedAt: opts.order as 'asc' | 'desc' };

    const [total, attempts] = await Promise.all([
      prisma.examAttempt.count({ where }),
      prisma.examAttempt.findMany({
        where,
        orderBy,
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        select: {
          id: true,
          totalScore: true,
          submittedAt: true,
          timeSpentSec: true,
          isAutoSubmitted: true,
          status: true,
          exam: {
            select: {
              id: true,
              title: true,
              totalQuestions: true,
              durationMin: true,
              passingScore: true,
              subject: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / opts.limit);

    return {
      data: attempts.map((a) => ({
        id: a.id,
        examId: a.exam.id,
        examTitle: a.exam.title,
        subjectId: a.exam.subject.id,
        subjectName: a.exam.subject.name,
        totalQuestions: a.exam.totalQuestions,
        durationMin: a.exam.durationMin,
        passingScore: a.exam.passingScore ? Number(a.exam.passingScore) : null,
        score: a.totalScore ? Number(a.totalScore) : 0,
        passed: a.exam.passingScore ? Number(a.totalScore ?? 0) >= Number(a.exam.passingScore) : null,
        submittedAt: a.submittedAt,
        timeSpentSec: a.timeSpentSec,
        isAutoSubmitted: a.isAutoSubmitted,
        status: a.status,
      })),
      pagination: {
        page: opts.page,
        limit: opts.limit,
        total,
        totalPages,
        hasNext: opts.page < totalPages,
        hasPrev: opts.page > 1,
      },
    };
  }
}

// ═══════════════════════════════════════════════════
// TEACHER ANALYTICS (UC30–36)
// ═══════════════════════════════════════════════════

export class TeacherAnalyticsService {
  /**
   * UC30 – Class Dashboard
   * Class overview: enrolled count, avg score, pass rate
   */
  async getClassDashboard(classId: number, teacherId: number) {
    const cls = await prisma.class.findFirst({
      where: { id: classId, teacherId },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        subject: { select: { id: true, name: true } },
        _count: { select: { classStudents: true, examAssignments: true } },
      },
    });

    if (!cls) return null;

    const studentIds = (
      await prisma.classStudent.findMany({
        where: { classId },
        select: { studentId: true },
      })
    ).map((s) => s.studentId);

    if (studentIds.length === 0) {
      return {
        class: { id: cls.id, name: cls.name, gradeLevel: cls.gradeLevel, subjectName: cls.subject.name },
        enrolledCount: 0,
        examCount: cls._count.examAssignments,
        avgScore: 0,
        passRate: 0,
        totalAttempts: 0,
      };
    }

    const examIds = (
      await prisma.examAssignment.findMany({
        where: { classId },
        select: { examId: true },
      })
    ).map((e) => e.examId);

    const attempts = await prisma.examAttempt.findMany({
      where: {
        studentId: { in: studentIds },
        examId: { in: examIds },
        status: { in: ['SUBMITTED', 'GRADED'] },
      },
      select: {
        totalScore: true,
        exam: { select: { passingScore: true } },
      },
    });

    const scores = attempts.map((a) => Number(a.totalScore ?? 0));
    const avgScore = scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : 0;

    const passedCount = attempts.filter((a) => {
      const passing = a.exam.passingScore ? Number(a.exam.passingScore) : 5;
      return Number(a.totalScore ?? 0) >= passing;
    }).length;

    const passRate = attempts.length > 0 ? Math.round((passedCount / attempts.length) * 10000) / 100 : 0;

    return {
      class: { id: cls.id, name: cls.name, gradeLevel: cls.gradeLevel, subjectName: cls.subject.name },
      enrolledCount: studentIds.length,
      examCount: cls._count.examAssignments,
      avgScore,
      passRate,
      totalAttempts: attempts.length,
    };
  }

  /**
   * UC31 – Performance Trend
   * Avg score per exam over time
   */
  async getClassPerformance(classId: number, teacherId: number, limit: number) {
    const cls = await prisma.class.findFirst({ where: { id: classId, teacherId } });
    if (!cls) return null;

    const assignments = await prisma.examAssignment.findMany({
      where: { classId },
      orderBy: { assignedAt: 'desc' },
      take: limit,
      select: {
        examId: true,
        exam: { select: { id: true, title: true, createdAt: true, passingScore: true } },
      },
    });

    const studentIds = (
      await prisma.classStudent.findMany({ where: { classId }, select: { studentId: true } })
    ).map((s) => s.studentId);

    const performanceData = [];

    for (const assignment of assignments) {
      const attempts = await prisma.examAttempt.findMany({
        where: {
          examId: assignment.examId,
          studentId: { in: studentIds },
          status: { in: ['SUBMITTED', 'GRADED'] },
        },
        select: { totalScore: true },
      });

      const scores = attempts.map((a) => Number(a.totalScore ?? 0));
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : 0;

      performanceData.push({
        examId: assignment.exam.id,
        examTitle: assignment.exam.title,
        date: assignment.exam.createdAt,
        avgScore,
        attemptCount: attempts.length,
        studentCount: studentIds.length,
      });
    }

    return performanceData.reverse();
  }

  /**
   * UC32 – Score Distribution
   * Histogram bins [0-2, 2-4, 4-6, 6-8, 8-10]
   */
  async getExamDistribution(examId: number, teacherId: number) {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, createdBy: teacherId },
      select: { id: true, title: true, totalQuestions: true, passingScore: true },
    });

    if (!exam) return null;

    const attempts = await prisma.examAttempt.findMany({
      where: { examId, status: { in: ['SUBMITTED', 'GRADED'] } },
      select: {
        totalScore: true,
        student: { select: { id: true, fullName: true } },
      },
    });

    const bins = [
      { label: '0-2', min: 0, max: 2, count: 0 },
      { label: '2-4', min: 2, max: 4, count: 0 },
      { label: '4-6', min: 4, max: 6, count: 0 },
      { label: '6-8', min: 6, max: 8, count: 0 },
      { label: '8-10', min: 8, max: 10, count: 0 },
    ];

    for (const a of attempts) {
      const score = Number(a.totalScore ?? 0);
      for (const bin of bins) {
        if (score >= bin.min && (score < bin.max || (bin.max === 10 && score <= 10))) {
          bin.count++;
          break;
        }
      }
    }

    const scores = attempts.map((a) => Number(a.totalScore ?? 0));
    const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    const median = scores.length > 0 ? scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] : 0;

    return {
      exam: { id: exam.id, title: exam.title },
      totalAttempts: attempts.length,
      avgScore: Math.round(avg * 100) / 100,
      medianScore: median,
      bins: bins.map((b) => ({ label: b.label, count: b.count })),
    };
  }

  /**
   * UC33 – Weak Students Detection
   * Students with avg < threshold for 3 consecutive exams
   */
  async getWeakStudents(classId: number, teacherId: number, threshold: number, consecutiveExams: number) {
    const cls = await prisma.class.findFirst({ where: { id: classId, teacherId } });
    if (!cls) return null;

    const studentIds = (
      await prisma.classStudent.findMany({
        where: { classId },
        select: { studentId: true },
      })
    ).map((s) => s.studentId);

    const examIds = (
      await prisma.examAssignment.findMany({
        where: { classId },
        orderBy: { assignedAt: 'desc' },
        select: { examId: true },
      })
    ).map((e) => e.examId);

    const weakStudents = [];

    for (const studentId of studentIds) {
      const recentAttempts = await prisma.examAttempt.findMany({
        where: {
          studentId,
          examId: { in: examIds },
          status: { in: ['SUBMITTED', 'GRADED'] },
        },
        orderBy: { submittedAt: 'desc' },
        take: consecutiveExams,
        select: {
          totalScore: true,
          submittedAt: true,
          exam: { select: { title: true } },
        },
      });

      if (recentAttempts.length < consecutiveExams) continue;

      const allBelowThreshold = recentAttempts.every((a) => Number(a.totalScore ?? 0) < threshold);

      if (allBelowThreshold) {
        const student = await prisma.user.findUnique({
          where: { id: studentId },
          select: { id: true, fullName: true, username: true },
        });

        const avgScore = recentAttempts.reduce((s, a) => s + Number(a.totalScore ?? 0), 0) / recentAttempts.length;

        weakStudents.push({
          student: { id: student?.id, fullName: student?.fullName, username: student?.username },
          avgScore: Math.round(avgScore * 100) / 100,
          recentScores: recentAttempts.map((a) => ({
            score: Number(a.totalScore ?? 0),
            examTitle: a.exam.title,
            submittedAt: a.submittedAt,
          })),
        });
      }
    }

    return weakStudents.sort((a, b) => a.avgScore - b.avgScore);
  }

  /**
   * UC34 – Compare Classes
   * Compare avg score between multiple classes
   */
  async compareClasses(teacherId: number, classIds: number[], subjectId?: number) {
    const classes = await prisma.class.findMany({
      where: { id: { in: classIds }, teacherId },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        subject: { select: { name: true } },
      },
    });

    const comparison = [];

    for (const cls of classes) {
      const studentIds = (
        await prisma.classStudent.findMany({ where: { classId: cls.id }, select: { studentId: true } })
      ).map((s) => s.studentId);

      const examFilter: Prisma.ExamAssignmentWhereInput = {
        classId: cls.id,
        ...(subjectId && { exam: { subjectId } }),
      };

      const examIds = (
        await prisma.examAssignment.findMany({ where: examFilter, select: { examId: true } })
      ).map((e) => e.examId);

      const attempts = await prisma.examAttempt.findMany({
        where: {
          studentId: { in: studentIds },
          examId: { in: examIds },
          status: { in: ['SUBMITTED', 'GRADED'] },
        },
        select: { totalScore: true, exam: { select: { passingScore: true } } },
      });

      const scores = attempts.map((a) => Number(a.totalScore ?? 0));
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : 0;
      const passedCount = attempts.filter((a) => {
        const passing = a.exam.passingScore ? Number(a.exam.passingScore) : 5;
        return Number(a.totalScore ?? 0) >= passing;
      }).length;

      comparison.push({
        classId: cls.id,
        className: cls.name,
        gradeLevel: cls.gradeLevel,
        subjectName: cls.subject.name,
        studentCount: studentIds.length,
        attemptCount: attempts.length,
        avgScore,
        passRate: attempts.length > 0 ? Math.round((passedCount / attempts.length) * 10000) / 100 : 0,
        highestScore: scores.length > 0 ? Math.max(...scores) : 0,
        lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      });
    }

    return comparison.sort((a, b) => b.avgScore - a.avgScore);
  }

  /**
   * UC35 – Exam Results
   * Per-student results table (sortable)
   */
  async getExamResults(
    examId: number,
    teacherId: number,
    opts: { page: number; limit: number; sort: string; order: string },
  ) {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, createdBy: teacherId },
      select: { id: true, title: true, totalQuestions: true, passingScore: true, durationMin: true },
    });

    if (!exam) return null;

    const orderBy: Prisma.ExamAttemptOrderByWithRelationInput =
      opts.sort === 'score'
        ? { totalScore: opts.order as 'asc' | 'desc' }
        : opts.sort === 'time'
          ? { timeSpentSec: opts.order as 'asc' | 'desc' }
          : { student: { fullName: opts.order as 'asc' | 'desc' } };

    const where: Prisma.ExamAttemptWhereInput = {
      examId,
      status: { in: ['SUBMITTED', 'GRADED'] },
    };

    const [total, attempts] = await Promise.all([
      prisma.examAttempt.count({ where }),
      prisma.examAttempt.findMany({
        where,
        orderBy,
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        select: {
          id: true,
          totalScore: true,
          timeSpentSec: true,
          submittedAt: true,
          isAutoSubmitted: true,
          student: { select: { id: true, fullName: true, username: true } },
          _count: { select: { attemptAnswers: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / opts.limit);

    return {
      exam: { id: exam.id, title: exam.title, totalQuestions: exam.totalQuestions, passingScore: exam.passingScore ? Number(exam.passingScore) : null },
      results: attempts.map((a) => ({
        attemptId: a.id,
        studentId: a.student.id,
        studentName: a.student.fullName,
        studentUsername: a.student.username,
        score: a.totalScore ? Number(a.totalScore) : 0,
        passed: exam.passingScore ? Number(a.totalScore ?? 0) >= Number(exam.passingScore) : null,
        timeSpentSec: a.timeSpentSec,
        isAutoSubmitted: a.isAutoSubmitted,
        submittedAt: a.submittedAt,
        answeredQuestions: a._count.attemptAnswers,
      })),
      pagination: {
        page: opts.page,
        limit: opts.limit,
        total,
        totalPages,
        hasNext: opts.page < totalPages,
        hasPrev: opts.page > 1,
      },
    };
  }

  /**
   * UC36 – Export Report (PDF / Excel)
   * Generate file → Upload to MinIO → Return signed download URL
   */
  async exportReport(
    teacherId: number,
    opts: { format: 'pdf' | 'excel'; reportType: string; classId?: number; examId?: number; title?: string },
  ) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `report-${opts.reportType}-${timestamp}.${opts.format === 'pdf' ? 'pdf' : 'xlsx'}`;

    let reportData: { title: string; headers: string[]; rows: (string | number)[][] };

    if (opts.reportType === 'exam_results' && opts.examId) {
      reportData = await this.buildExamResultsReport(opts.examId, teacherId);
    } else if (opts.reportType === 'class_results' && opts.classId) {
      reportData = await this.buildClassResultsReport(opts.classId, teacherId);
    } else if (opts.reportType === 'exam_summary' && opts.examId) {
      reportData = await this.buildExamSummaryReport(opts.examId, teacherId);
    } else if (opts.reportType === 'question_analysis' && opts.examId) {
      reportData = await this.buildQuestionAnalysisReport(opts.examId, teacherId);
    } else if (opts.reportType === 'student_results' && opts.examId) {
      reportData = await this.buildStudentResultsReport(opts.examId, teacherId);
    } else {
      reportData = { title: opts.title || 'Report', headers: ['No data'], rows: [] };
    }

    let buffer: Buffer;
    let contentType: string;

    if (opts.format === 'pdf') {
      buffer = await this.generatePdf(reportData, opts.title);
      contentType = 'application/pdf';
    } else {
      buffer = this.generateExcel(reportData, opts.title);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    const minio = getMinioClient();
    const bucketExists = await minio.bucketExists(REPORTS_BUCKET);
    if (!bucketExists) {
      await minio.makeBucket(REPORTS_BUCKET, 'us-east-1');
    }

    const objectName = `teacher-${teacherId}/${filename}`;
    await minio.putObject(REPORTS_BUCKET, objectName, buffer, buffer.length, {
      'Content-Type': contentType,
    });

    const downloadUrl = await minio.presignedGetObject(REPORTS_BUCKET, objectName, 3600);

    // Record export history so it can be listed and re-downloaded later (PDF §4/§8).
    const record = await prisma.reportExport.create({
      data: {
        userId: teacherId,
        reportType: opts.reportType,
        targetId: opts.examId ?? opts.classId ?? null,
        format: opts.format,
        fileUrl: downloadUrl,
        objectName,
        status: 'completed',
      },
      select: { id: true, createdAt: true },
    });

    return {
      id: record.id,
      filename,
      format: opts.format,
      size: buffer.length,
      downloadUrl,
      expiresIn: '1 hour',
      createdAt: record.createdAt,
    };
  }

  /** Paginated-free export history for a teacher (most recent first). */
  async getExportHistory(teacherId: number, limit = 30) {
    const rows = await prisma.reportExport.findMany({
      where: { userId: teacherId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        reportType: true,
        targetId: true,
        format: true,
        status: true,
        createdAt: true,
      },
    });
    return rows;
  }

  /** Re-presign a previously generated export the teacher owns. */
  async getDownloadUrl(exportId: number, teacherId: number) {
    const record = await prisma.reportExport.findFirst({
      where: { id: exportId, userId: teacherId },
      select: { objectName: true, format: true },
    });
    if (!record || !record.objectName) {
      throw new AppError('Export not found', 404);
    }
    const minio = getMinioClient();
    const downloadUrl = await minio.presignedGetObject(REPORTS_BUCKET, record.objectName, 3600);
    return { downloadUrl, format: record.format, expiresIn: '1 hour' };
  }

  // ── Report builders for the analytics export bundles (PDF §8) ──

  private async buildExamSummaryReport(examId: number, teacherId: number) {
    const data = await examAnalyticsService.getSummary(examId, teacherId, 'teacher');
    const exam = data.exam;
    const s = (data.summary ?? {}) as unknown as Record<string, number | null>;
    const fmt = (v: number | null | undefined) => (v == null ? '—' : String(v));
    return {
      title: `Exam Summary: ${exam?.title ?? `#${examId}`}`,
      headers: ['Metric', 'Value'],
      rows: [
        ['Submitted attempts', fmt(s.totalAttempts)],
        ['Assigned students', fmt(s.assignedCount)],
        ['Completion rate (%)', fmt(s.completionRate)],
        ['Average score', fmt(s.avgScore)],
        ['Median score', fmt(s.medianScore)],
        ['Highest score', fmt(s.maxScoreAchieved)],
        ['Lowest score', fmt(s.minScore)],
        ['Max score', fmt(s.maxScore)],
        ['Passing score', fmt(s.passingScore)],
        ['Pass rate (%)', fmt(s.passRate)],
        ['Average time (sec)', fmt(s.avgTimeSec)],
      ] as (string | number)[][],
    };
  }

  private async buildQuestionAnalysisReport(examId: number, teacherId: number) {
    const questions = await examAnalyticsService.getQuestions(examId, teacherId, 'teacher');
    return {
      title: `Question Analysis (Exam #${examId})`,
      headers: ['#', 'Correct %', 'Skipped %', 'Avg time (s)', 'Discrimination', 'Quality'],
      rows: questions.map((q) => [
        q.orderIndex + 1,
        q.correctRate ?? '—',
        q.skippedRate ?? '—',
        q.avgTimeSec ?? '—',
        q.discrimination ?? '—',
        q.qualityFlag,
      ]) as (string | number)[][],
    };
  }

  private async buildStudentResultsReport(examId: number, teacherId: number) {
    const students = await examAnalyticsService.getStudents(examId, teacherId, 'teacher');
    return {
      title: `Student Results (Exam #${examId})`,
      headers: ['Rank', 'Student', 'Score', 'Passed', 'Time (min)', 'Risk'],
      rows: students.map((s) => [
        s.rank,
        s.student.name || s.student.username,
        s.score,
        s.passed === null ? '—' : s.passed ? 'Pass' : 'Fail',
        s.timeSpentSec ? Math.round(s.timeSpentSec / 60) : 0,
        s.riskLevel,
      ]) as (string | number)[][],
    };
  }

  private async buildExamResultsReport(examId: number, teacherId: number) {
    const result = await this.getExamResults(examId, teacherId, { page: 1, limit: 1000, sort: 'score', order: 'desc' });
    if (!result) return { title: 'Exam Results', headers: [], rows: [] as (string | number)[][] };

    return {
      title: `Exam Results: ${result.exam.title}`,
      headers: ['No.', 'Full Name', 'Username', 'Score', 'Pass/Fail', 'Time (minutes)', 'Submitted At'],
      rows: result.results.map((r, i) => [
        i + 1,
        r.studentName || '',
        r.studentUsername || '',
        r.score,
        r.passed === null ? '-' : r.passed ? 'Pass' : 'Fail',
        r.timeSpentSec ? Math.round(r.timeSpentSec / 60) : 0,
        r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-US') : '',
      ]),
    };
  }

  private async buildClassResultsReport(classId: number, teacherId: number) {
    const dashboard = await this.getClassDashboard(classId, teacherId);
    if (!dashboard) return { title: 'Class Results', headers: [], rows: [] as (string | number)[][] };

    const students = await prisma.classStudent.findMany({
      where: { classId },
      select: {
        student: {
          select: {
            id: true,
            fullName: true,
            username: true,
            examAttempts: {
              where: { status: { in: ['SUBMITTED', 'GRADED'] } },
              select: { totalScore: true },
            },
          },
        },
      },
    });

    return {
      title: `Class Summary: ${dashboard.class.name}`,
      headers: ['No.', 'Full Name', 'Username', 'Attempts', 'Avg Score', 'Max Score', 'Min Score'],
      rows: students.map((s, i) => {
        const scores = s.student.examAttempts.map((a) => Number(a.totalScore ?? 0));
        const avg = scores.length > 0 ? Math.round((scores.reduce((sum, v) => sum + v, 0) / scores.length) * 100) / 100 : 0;
        return [
          i + 1,
          s.student.fullName || '',
          s.student.username || '',
          scores.length,
          avg,
          scores.length > 0 ? Math.max(...scores) : 0,
          scores.length > 0 ? Math.min(...scores) : 0,
        ];
      }),
    };
  }

  private async generatePdf(
    data: { title: string; headers: string[]; rows: (string | number)[][] },
    customTitle?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).font('Helvetica-Bold').text(customTitle || data.title, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Generated: ${new Date().toLocaleString('vi-VN')}`, { align: 'center' });
      doc.moveDown(1);

      if (data.headers.length > 0 && data.rows.length > 0) {
        const pageWidth = doc.page.width - 80;
        const colWidth = pageWidth / data.headers.length;
        const startX = 40;
        let y = doc.y;

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#fff');
        doc.rect(startX, y, pageWidth, 20).fill('#2563eb');
        data.headers.forEach((h, i) => {
          doc.fillColor('#fff').text(String(h), startX + i * colWidth + 4, y + 5, {
            width: colWidth - 8,
            align: 'left',
          });
        });
        y += 22;

        doc.font('Helvetica').fontSize(8).fillColor('#333');
        for (const row of data.rows) {
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 40;
          }

          const rowIndex = data.rows.indexOf(row);
          if (rowIndex % 2 === 0) {
            doc.rect(startX, y, pageWidth, 16).fill('#f8fafc');
          }
          doc.fillColor('#333');
          row.forEach((cell, i) => {
            doc.text(String(cell), startX + i * colWidth + 4, y + 3, {
              width: colWidth - 8,
              align: 'left',
            });
          });
          y += 18;
        }

        doc.moveDown(1);
        doc.fontSize(9).fillColor('#999').text(`Total: ${data.rows.length} records`, { align: 'right' });
      } else {
        doc.fontSize(12).fillColor('#999').text('No data available', { align: 'center' });
      }

      doc.end();
    });
  }

  private generateExcel(
    data: { title: string; headers: string[]; rows: (string | number)[][] },
    customTitle?: string,
  ): Buffer {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      [customTitle || data.title],
      [`Generated: ${new Date().toLocaleString('vi-VN')}`],
      [],
      data.headers,
      ...data.rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(summaryData);

    ws['!cols'] = data.headers.map(() => ({ wch: 18 }));

    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    if (data.rows.length > 0) {
      const detailWs = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
      detailWs['!cols'] = data.headers.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, detailWs, 'Detail');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buf);
  }
}

export const studentAnalyticsService = new StudentAnalyticsService();
export const teacherAnalyticsService = new TeacherAnalyticsService();
