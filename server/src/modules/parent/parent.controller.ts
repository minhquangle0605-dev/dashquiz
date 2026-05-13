import type { Request, Response, NextFunction } from 'express';

import { parentService } from './parent.service';
import { AppError } from '../../middlewares/errorHandler';
import type { ChildResultsQuery, ChildAnalyticsQuery } from './parent.validation';

/**
 * In dual-login mode the parent's session is scoped to a single student.
 * The JWT carries `studentId` (and `id` is the same value); we always use it
 * instead of trusting an arbitrary id from the URL/body.
 */
function getSessionStudentId(req: Request): number {
  const id = req.user?.studentId ?? req.user?.id;
  if (id === undefined) {
    throw new AppError('Parent session is missing student context', 401);
  }
  return id;
}

export async function getChildren(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = getSessionStudentId(req);
    const data = await parentService.getChildren(studentId);

    res.json({
      success: true,
      message: 'Children list retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getChildResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionStudentId = getSessionStudentId(req);
    const childId = parseInt(req.params.id, 10);
    if (isNaN(childId)) throw new AppError('Invalid child ID', 400);

    const query = (req as Request & { validatedQuery?: ChildResultsQuery }).validatedQuery ?? {
      page: 1,
      limit: 20,
      sort: 'date' as const,
      order: 'desc' as const,
    };

    const result = await parentService.getChildResults(sessionStudentId, childId, query);

    res.json({
      success: true,
      message: 'Child exam results retrieved',
      data: result.data,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getChildDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionStudentId = getSessionStudentId(req);
    const childId = parseInt(req.params.id, 10);
    if (isNaN(childId)) throw new AppError('Invalid child ID', 400);

    const { subjectId } = (req as Request & { validatedQuery?: ChildAnalyticsQuery }).validatedQuery ?? {};

    const data = await parentService.getChildDashboard(sessionStudentId, childId, subjectId);

    res.json({
      success: true,
      message: 'Child dashboard retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getChildStrengths(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionStudentId = getSessionStudentId(req);
    const childId = parseInt(req.params.id, 10);
    if (isNaN(childId)) throw new AppError('Invalid child ID', 400);

    const { subjectId } = (req as Request & { validatedQuery?: ChildAnalyticsQuery }).validatedQuery ?? {};

    const data = await parentService.getChildStrengths(sessionStudentId, childId, subjectId);

    res.json({
      success: true,
      message: 'Child strengths analysis retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
