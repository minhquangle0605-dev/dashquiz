import type { Request, Response, NextFunction } from 'express';
import { curriculumService } from './curriculum.service';
import { AppError } from '../../middlewares/errorHandler';

// ═══════════════════════════════════════════════
// LIST SUBJECTS (GET /api/subjects)
// ═══════════════════════════════════════════════

export async function listSubjects(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await curriculumService.listSubjects();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// CHAPTERS BY SUBJECT (GET /api/subjects/:id/chapters)
// ═══════════════════════════════════════════════

export async function getChaptersBySubject(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid subject ID', 400);
    const result = await curriculumService.getChaptersBySubject(id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// TOPICS BY CHAPTER (GET /api/chapters/:id/topics)
// ═══════════════════════════════════════════════

export async function getTopicsByChapter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid chapter ID', 400);
    const result = await curriculumService.getTopicsByChapter(id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// CREATE CHAPTER (POST /api/chapters)
// ═══════════════════════════════════════════════

export async function createChapter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await curriculumService.createChapter(req.body);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// CREATE TOPIC (POST /api/topics)
// ═══════════════════════════════════════════════

export async function createTopic(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await curriculumService.createTopic(req.body);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// TOPIC RELATIONS (GET /api/topics/:id/relations)
// ═══════════════════════════════════════════════

export async function getTopicRelations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid topic ID', 400);
    const result = await curriculumService.getTopicRelations(id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
