import type { Request, Response, NextFunction } from 'express';

import { knowledgeGraphService } from './knowledgeGraph.service';
import { AppError } from '../../middlewares/errorHandler';

type QueryWithSubject = Request & { validatedQuery?: { subjectId?: number } };

function send(res: Response, message: string, data: unknown): void {
  res.json({ success: true, message, data, timestamp: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════
// STUDENT
// ═══════════════════════════════════════════════════

export async function getMyGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user!.id;
    const { subjectId } = (req as QueryWithSubject).validatedQuery ?? {};
    const data = await knowledgeGraphService.getStudentGraph(studentId, subjectId);
    send(res, 'Student knowledge graph retrieved', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getMyRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user!.id;
    const { subjectId } = (req as QueryWithSubject).validatedQuery ?? {};
    const data = await knowledgeGraphService.getStudentRecommendations(studentId, subjectId);
    send(res, 'Recommendations retrieved', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════════
// TEACHER
// ═══════════════════════════════════════════════════

export async function getStudentGraphForTeacher(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) throw new AppError('Invalid student ID', 400);
    const { subjectId } = (req as QueryWithSubject).validatedQuery ?? {};

    const data = await knowledgeGraphService.getStudentGraphForTeacher(studentId, teacherId, subjectId);
    if (!data) throw new AppError('Student not found in your classes', 404);
    send(res, 'Student knowledge graph retrieved', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getClassGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const classId = parseInt(req.params.classId, 10);
    if (isNaN(classId)) throw new AppError('Invalid class ID', 400);
    const { subjectId } = (req as QueryWithSubject).validatedQuery ?? {};

    const data = await knowledgeGraphService.getClassGraph(classId, teacherId, subjectId);
    if (!data) throw new AppError('Class not found or unauthorized', 404);
    send(res, 'Class knowledge graph retrieved', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getClassWeakNodes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const classId = parseInt(req.params.classId, 10);
    if (isNaN(classId)) throw new AppError('Invalid class ID', 400);
    const { subjectId } = (req as QueryWithSubject).validatedQuery ?? {};

    const data = await knowledgeGraphService.getClassWeakNodes(classId, teacherId, subjectId);
    if (!data) throw new AppError('Class not found or unauthorized', 404);
    send(res, 'Class weak nodes retrieved', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════

export async function listNodes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { subjectId } = (req as QueryWithSubject).validatedQuery ?? {};
    const data = await knowledgeGraphService.listNodes(subjectId);
    send(res, 'Knowledge nodes retrieved', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function autogenerate(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await knowledgeGraphService.autogenerate();
    send(res, 'Knowledge nodes generated', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function recalculateAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await knowledgeGraphService.recalculateAll();
    send(res, 'Mastery recalculated for all students', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid node ID', 400);
    const data = await knowledgeGraphService.updateNode(id, req.body);
    send(res, 'Knowledge node updated', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function deleteNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid node ID', 400);
    const data = await knowledgeGraphService.deleteNode(id);
    send(res, 'Knowledge node deleted', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
