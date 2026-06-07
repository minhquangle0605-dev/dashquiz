import type { Request, Response, NextFunction } from 'express';

import { studentAnalyticsService, teacherAnalyticsService, invalidateStudentCache } from './analytics.service';
import { AppError } from '../../middlewares/errorHandler';

// ═══════════════════════════════════════════════════
// STUDENT ANALYTICS (UC10–15)
// ═══════════════════════════════════════════════════

export async function getStudentDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user!.id;
    const { subjectId } = (req as Request & { validatedQuery?: { subjectId?: number } }).validatedQuery ?? {};

    const data = await studentAnalyticsService.getDashboard(studentId, subjectId);

    res.json({
      success: true,
      message: 'Student dashboard retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getStudentPatterns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user!.id;
    const { subjectId } = (req as Request & { validatedQuery?: { subjectId?: number } }).validatedQuery ?? {};

    const data = await studentAnalyticsService.getPatterns(studentId, subjectId);

    res.json({
      success: true,
      message: 'Student answer patterns retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getStudentAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user!.id;
    const query = (req as Request & { validatedQuery?: Record<string, unknown> }).validatedQuery as {
      page: number;
      limit: number;
      subjectId?: number;
      dateFrom?: string;
      dateTo?: string;
      sort: string;
      order: string;
    };

    const result = await studentAnalyticsService.getAttempts(studentId, query);

    res.json({
      success: true,
      message: 'Student attempts retrieved',
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function invalidateStudentCacheEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user!.id;
    await invalidateStudentCache(studentId);
    res.json({ success: true, message: 'Student analytics cache invalidated' });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════════
// TEACHER ANALYTICS (UC30–36)
// ═══════════════════════════════════════════════════

export async function getClassDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const classId = parseInt(req.params.id, 10);

    if (isNaN(classId)) {
      throw new AppError('Invalid class ID', 400);
    }

    const data = await teacherAnalyticsService.getClassDashboard(classId, teacherId);

    if (!data) {
      throw new AppError('Class not found or unauthorized', 404);
    }

    res.json({
      success: true,
      message: 'Class dashboard retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getClassPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const classId = parseInt(req.params.id, 10);
    const { limit } = (req as Request & { validatedQuery?: { limit?: number } }).validatedQuery ?? {};

    if (isNaN(classId)) {
      throw new AppError('Invalid class ID', 400);
    }

    const data = await teacherAnalyticsService.getClassPerformance(classId, teacherId, limit || 10);

    if (!data) {
      throw new AppError('Class not found or unauthorized', 404);
    }

    res.json({
      success: true,
      message: 'Class performance trend retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getExamDistribution(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const examId = parseInt(req.params.id, 10);

    if (isNaN(examId)) {
      throw new AppError('Invalid exam ID', 400);
    }

    const data = await teacherAnalyticsService.getExamDistribution(examId, teacherId);

    if (!data) {
      throw new AppError('Exam not found or unauthorized', 404);
    }

    res.json({
      success: true,
      message: 'Exam score distribution retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getWeakStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const classId = parseInt(req.params.id, 10);
    const { threshold, consecutiveExams } = (
      req as Request & { validatedQuery?: { threshold?: number; consecutiveExams?: number } }
    ).validatedQuery ?? {};

    if (isNaN(classId)) {
      throw new AppError('Invalid class ID', 400);
    }

    const data = await teacherAnalyticsService.getWeakStudents(
      classId,
      teacherId,
      threshold ?? 5,
      consecutiveExams ?? 3,
    );

    if (!data) {
      throw new AppError('Class not found or unauthorized', 404);
    }

    res.json({
      success: true,
      message: 'Weak students identified',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function compareClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const { classIds, subjectId } = (
      req as Request & { validatedQuery?: { classIds?: number[]; subjectId?: number } }
    ).validatedQuery ?? {};

    if (!classIds || classIds.length < 2) {
      throw new AppError('At least 2 class IDs are required', 400);
    }

    const data = await teacherAnalyticsService.compareClasses(teacherId, classIds, subjectId);

    res.json({
      success: true,
      message: 'Class comparison retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getExamResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const examId = parseInt(req.params.id, 10);
    const query = (req as Request & { validatedQuery?: Record<string, unknown> }).validatedQuery as {
      page: number;
      limit: number;
      sort: string;
      order: string;
    };

    if (isNaN(examId)) {
      throw new AppError('Invalid exam ID', 400);
    }

    const result = await teacherAnalyticsService.getExamResults(examId, teacherId, query);

    if (!result) {
      throw new AppError('Exam not found or unauthorized', 404);
    }

    res.json({
      success: true,
      message: 'Exam results retrieved',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const { format, reportType, classId, examId, title } = req.body;

    const data = await teacherAnalyticsService.exportReport(teacherId, {
      format,
      reportType,
      classId,
      examId,
      title,
    });

    res.json({
      success: true,
      message: `Report exported as ${format.toUpperCase()}`,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getExportHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const data = await teacherAnalyticsService.getExportHistory(teacherId);
    res.json({
      success: true,
      message: 'Export history retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getExportDownload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const exportId = parseInt(req.params.id, 10);
    if (isNaN(exportId)) throw new AppError('Invalid export ID', 400);
    const data = await teacherAnalyticsService.getDownloadUrl(exportId, teacherId);
    res.json({
      success: true,
      message: 'Download URL retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
