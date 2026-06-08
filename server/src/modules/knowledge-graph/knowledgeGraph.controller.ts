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

export async function getMyLearningPath(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user!.id;
    const { targetNodeId } = (req as Request & { validatedQuery?: { targetNodeId: number } })
      .validatedQuery ?? { targetNodeId: NaN };
    const data = await knowledgeGraphService.getLearningPath(studentId, targetNodeId);
    send(res, 'Learning path retrieved', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function generateMyPractice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user!.id;
    const { nodeId, questionCount } = req.body as { nodeId: number; questionCount?: number };
    const data = await knowledgeGraphService.generateStudentPractice(studentId, nodeId, questionCount);
    send(res, 'Practice set generated', data);
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

export async function assignClassPractice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const classId = parseInt(req.params.classId, 10);
    if (isNaN(classId)) throw new AppError('Invalid class ID', 400);
    const { nodeId, questionCount } = req.body as { nodeId: number; questionCount?: number };
    const data = await knowledgeGraphService.assignClassPractice(
      teacherId,
      classId,
      nodeId,
      questionCount,
    );
    send(res, 'Practice assigned to class', data);
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

// ─── Relations (Package B) ─────────────────────────

type RelationQuery = Request & {
  validatedQuery?: { nodeId?: number; relationType?: import('./knowledgeGraph.types').RelationType };
};

export async function listRelations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nodeId, relationType } = (req as RelationQuery).validatedQuery ?? {};
    const data = await knowledgeGraphService.listRelations({ nodeId, relationType });
    send(res, 'Knowledge relations retrieved', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function createRelation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await knowledgeGraphService.createRelation(req.body, req.user!.id);
    send(res, 'Knowledge relation created', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function deleteRelation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid relation ID', 400);
    const data = await knowledgeGraphService.deleteRelation(id);
    send(res, 'Knowledge relation deleted', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function seedPartOfRelations(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await knowledgeGraphService.seedPartOfRelations();
    send(res, 'PART_OF relations seeded', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ─── Governance (Package C) ────────────────────────

export async function getQualityReport(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await knowledgeGraphService.getQualityReport();
    send(res, 'Taxonomy quality report retrieved', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function listNodeAliases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid node ID', 400);
    const data = await knowledgeGraphService.listNodeAliases(id);
    send(res, 'Node aliases retrieved', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function addNodeAlias(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid node ID', 400);
    const data = await knowledgeGraphService.addNodeAlias(id, req.body.alias);
    send(res, 'Alias added', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function deleteNodeAlias(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const aliasId = parseInt(req.params.aliasId, 10);
    if (isNaN(aliasId)) throw new AppError('Invalid alias ID', 400);
    const data = await knowledgeGraphService.deleteNodeAlias(aliasId);
    send(res, 'Alias deleted', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function mergeNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid node ID', 400);
    const data = await knowledgeGraphService.mergeNodes(id, req.body.targetNodeId);
    send(res, 'Nodes merged', data);
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
