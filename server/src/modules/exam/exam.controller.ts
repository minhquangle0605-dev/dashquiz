import type { Request, Response, NextFunction } from 'express';
import { examService } from './exam.service';
import { examReportService } from './examReport.service';
import { examSecurityService } from './examSecurity.service';
import { AppError } from '../../middlewares/errorHandler';
import type {
  ExamMonitoringQuery,
  ListExamsQuery,
  GradeAnswerInput,
  ExamSecuritySettingsInput,
  ProctorReviewInput,
} from './exam.validation';

// ═══════════════════════════════════════════════
// LIST EXAMS (GET /api/exams)
// ═══════════════════════════════════════════════

export async function listExams(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const query = req.query as unknown as ListExamsQuery;
    const result = await examService.listExams(query, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// GET EXAM (GET /api/exams/:id)
// ═══════════════════════════════════════════════

export async function getExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examService.getExamById(id, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// CREATE EXAM (POST /api/exams)
// ═══════════════════════════════════════════════

export async function createExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const result = await examService.createExam(req.body, req.user.id);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// UPDATE EXAM (PUT /api/exams/:id)
// ═══════════════════════════════════════════════

export async function updateExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examService.updateExam(id, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// DELETE EXAM (DELETE /api/exams/:id)
// ═══════════════════════════════════════════════

export async function deleteExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examService.deleteExam(id, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// ADD QUESTIONS (POST /api/exams/:id/questions)
// ═══════════════════════════════════════════════

export async function addQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examService.addQuestions(id, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// PUBLISH EXAM (PUT /api/exams/:id/publish)
// ═══════════════════════════════════════════════

export async function publishExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examService.publishExam(id, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// SCHEDULE EXAM (POST /api/exams/:id/schedule)
// ═══════════════════════════════════════════════

export async function scheduleExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examService.scheduleExam(id, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// ASSIGN EXAM (POST /api/exams/:id/assign)
// ═══════════════════════════════════════════════

export async function assignExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examService.assignExam(id, req.body, req.user.id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// GET ASSIGNMENTS (GET /api/exams/:id/assignments)
// ═══════════════════════════════════════════════

export async function getAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examService.getAssignments(id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getMonitoring(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const query = (req as Request & { validatedQuery?: ExamMonitoringQuery }).validatedQuery ?? {};
    const result = await examService.getExamMonitoring(id, req.user.id, req.user.role, query);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getSecuritySettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examSecurityService.getExamSecuritySettings(
      id,
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateSecuritySettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examSecurityService.updateExamSecuritySettings(
      id,
      req.body as ExamSecuritySettingsInput,
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getEvidenceReport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const examId = parseInt(req.params.id, 10);
    const attemptId = parseInt(req.params.attemptId, 10);
    if (isNaN(examId) || isNaN(attemptId)) throw new AppError('Invalid identifier', 400);
    const result = await examSecurityService.getEvidenceReport(
      examId,
      attemptId,
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function saveProctorReview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const examId = parseInt(req.params.id, 10);
    const attemptId = parseInt(req.params.attemptId, 10);
    if (isNaN(examId) || isNaN(attemptId)) throw new AppError('Invalid identifier', 400);
    const result = await examSecurityService.saveProctorReview(
      examId,
      attemptId,
      req.body as ProctorReviewInput,
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// EXAM REPORTS (§12)
// ═══════════════════════════════════════════════

export async function getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid exam ID', 400);
    const result = await examReportService.getReport(id, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function gradeAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const examId = parseInt(req.params.id, 10);
    const attemptId = parseInt(req.params.attemptId, 10);
    const answerId = parseInt(req.params.answerId, 10);
    if (isNaN(examId) || isNaN(attemptId) || isNaN(answerId)) {
      throw new AppError('Invalid identifier', 400);
    }
    const result = await examReportService.gradeAnswer(
      examId,
      attemptId,
      answerId,
      req.body as GradeAnswerInput,
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function deleteAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const examId = parseInt(req.params.id, 10);
    const attemptId = parseInt(req.params.attemptId, 10);
    if (isNaN(examId) || isNaN(attemptId)) throw new AppError('Invalid identifier', 400);
    const result = await examReportService.deleteAttempt(examId, attemptId, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
