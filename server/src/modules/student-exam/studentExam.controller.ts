import type { Request, Response, NextFunction } from 'express';
import { studentExamService } from './studentExam.service';
import { AppError } from '../../middlewares/errorHandler';
import type { ListStudentExamsQuery, ListAttemptsQuery } from './studentExam.validation';

// ═══════════════════════════════════════════════
// LIST ASSIGNED EXAMS (GET /api/student/exams)
// ═══════════════════════════════════════════════

export async function listStudentExams(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const query = (req as any).validatedQuery as ListStudentExamsQuery;
    const result = await studentExamService.listStudentExams(query, req.user.id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// START EXAM (POST /api/student/exams/:id/start)
// ═══════════════════════════════════════════════

export async function startExam(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const examId = parseInt(req.params.id, 10);
    if (isNaN(examId)) throw new AppError('Invalid exam ID', 400);
    const password =
      typeof req.body?.password === 'string' ? req.body.password : undefined;
    const result = await studentExamService.startExam(examId, req.user.id, password);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// SAVE ANSWERS (PUT /api/student/attempts/:id/save)
// ═══════════════════════════════════════════════

export async function saveAnswers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const attemptId = parseInt(req.params.id, 10);
    if (isNaN(attemptId)) throw new AppError('Invalid attempt ID', 400);
    const result = await studentExamService.saveAnswers(attemptId, req.body, req.user.id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// SUBMIT ATTEMPT (POST /api/student/attempts/:id/submit)
// ═══════════════════════════════════════════════

export async function submitAttempt(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const attemptId = parseInt(req.params.id, 10);
    if (isNaN(attemptId)) throw new AppError('Invalid attempt ID', 400);
    const result = await studentExamService.submitAttempt(attemptId, req.body, req.user.id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function recordAttemptEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const attemptId = parseInt(req.params.id, 10);
    if (isNaN(attemptId)) throw new AppError('Invalid attempt ID', 400);
    const result = await studentExamService.recordAttemptEvent(attemptId, req.body, req.user.id);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// GET RESULT (GET /api/student/attempts/:id/result)
// ═══════════════════════════════════════════════

export async function getAttemptResult(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const attemptId = parseInt(req.params.id, 10);
    if (isNaN(attemptId)) throw new AppError('Invalid attempt ID', 400);
    const result = await studentExamService.getAttemptResult(attemptId, req.user.id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// LIST ATTEMPTS (GET /api/student/attempts)
// ═══════════════════════════════════════════════

export async function listAttempts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const query = (req as any).validatedQuery as ListAttemptsQuery;
    const result = await studentExamService.listAttempts(query, req.user.id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
