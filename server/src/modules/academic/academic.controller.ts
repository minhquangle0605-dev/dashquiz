import type { Request, Response, NextFunction } from 'express';
import { academicService } from './academic.service';
import { AppError } from '../../middlewares/errorHandler';
import type { ListSemestersQuery } from './academic.validation';

export async function listSubjects(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await academicService.listSubjects();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateSubject(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid subject ID', 400);
    }
    const result = await academicService.updateSubject(id, req.body);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function listAcademicYears(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await academicService.listAcademicYears();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function createAcademicYear(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await academicService.createAcademicYear(req.body);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateAcademicYear(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid academic year ID', 400);
    }
    const result = await academicService.updateAcademicYear(id, req.body);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function listSemesters(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await academicService.listSemesters(req.query as unknown as ListSemestersQuery);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function createSemester(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await academicService.createSemester(req.body);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateSemester(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid semester ID', 400);
    }
    const result = await academicService.updateSemester(id, req.body);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
