import type { Request, Response, NextFunction } from 'express';

import { examAnalyticsService } from './examAnalytics.service';
import { AppError } from '../../middlewares/errorHandler';

function parseExamId(req: Request): number {
  const examId = parseInt(req.params.id, 10);
  if (Number.isNaN(examId)) throw new AppError('Invalid exam ID', 400);
  return examId;
}

function wantsRefresh(req: Request): boolean {
  return req.query.refresh === 'true' || req.query.refresh === '1';
}

export async function getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const data = await examAnalyticsService.getSummary(
      parseExamId(req),
      req.user.id,
      req.user.role,
      wantsRefresh(req),
    );
    res.json({ success: true, message: 'Exam analytics summary retrieved', data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const data = await examAnalyticsService.getQuestions(
      parseExamId(req),
      req.user.id,
      req.user.role,
      wantsRefresh(req),
    );
    res.json({ success: true, message: 'Exam question analytics retrieved', data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const data = await examAnalyticsService.getStudents(parseExamId(req), req.user.id, req.user.role);
    res.json({ success: true, message: 'Exam student analytics retrieved', data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function recalculate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const data = await examAnalyticsService.recalculate(parseExamId(req), req.user.id, req.user.role);
    res.json({ success: true, message: 'Exam analytics recalculated', data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const data = await examAnalyticsService.getStatus(parseExamId(req), req.user.id, req.user.role);
    res.json({ success: true, message: 'Exam analytics status retrieved', data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
