import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middlewares/errorHandler';
import { gradebookService } from './gradebook.service';

function parseId(value: string | undefined, label: string) {
  const id = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(id)) throw new AppError(`Invalid ${label}`, 400);
  return id;
}

export async function getClassGradebook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseId(req.params.id, 'class ID');
    const result = await gradebookService.getClassGradebook(
      classId,
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getAccessibleGradebooks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const result = await gradebookService.getAccessibleGradebooks(
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getMyGradebook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseId(req.params.id, 'class ID');
    const studentId =
      req.user.role === 'parent'
        ? req.user.studentId ?? req.user.id
        : req.user.id;
    const result = await gradebookService.getMyGradebook(
      classId,
      req.user.id,
      req.user.role,
      studentId,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function createManualGrade(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseId(req.params.id, 'class ID');
    const result = await gradebookService.createManualGrade(
      classId,
      req.body,
      req.user.id,
      req.user.role,
    );
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateGradeScore(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseId(req.params.id, 'class ID');
    const gradeId = parseId(req.params.gradeId, 'grade ID');
    const result = await gradebookService.updateGradeScore(
      classId,
      gradeId,
      req.body,
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function deleteGrade(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseId(req.params.id, 'class ID');
    const gradeId = parseId(req.params.gradeId, 'grade ID');
    const reason =
      typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const result = await gradebookService.deleteGrade(
      classId,
      gradeId,
      req.user.id,
      req.user.role,
      reason,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function listGradeHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseId(req.params.id, 'class ID');
    const gradeId = parseId(req.params.gradeId, 'grade ID');
    const result = await gradebookService.listGradeHistory(
      classId,
      gradeId,
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function listClassHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseId(req.params.id, 'class ID');
    const result = await gradebookService.listClassHistory(
      classId,
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function linkClass(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseId(req.params.id, 'class ID');
    const result = await gradebookService.linkClass(
      classId,
      req.body,
      req.user.id,
      req.user.role,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
