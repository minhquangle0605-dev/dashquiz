import type { Request, Response, NextFunction } from 'express';

import { parentService } from './parent.service';
import { AppError } from '../../middlewares/errorHandler';
import type {
  ChildResultsQuery,
  ChildAnalyticsQuery,
  ChildLearningPathQuery,
} from './parent.validation';

function getParentUserId(req: Request): number {
  const id = req.user?.id;
  if (id === undefined) {
    throw new AppError('Parent session is missing user context', 401);
  }
  return id;
}

export async function getChildren(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parentUserId = getParentUserId(req);
    const data = await parentService.getChildren(parentUserId);

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
    const parentUserId = getParentUserId(req);
    const childId = parseInt(req.params.id, 10);
    if (isNaN(childId)) throw new AppError('Invalid child ID', 400);

    const query = (req as Request & { validatedQuery?: ChildResultsQuery }).validatedQuery ?? {
      page: 1,
      limit: 20,
      sort: 'date' as const,
      order: 'desc' as const,
    };

    const result = await parentService.getChildResults(parentUserId, childId, query);

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
    const parentUserId = getParentUserId(req);
    const childId = parseInt(req.params.id, 10);
    if (isNaN(childId)) throw new AppError('Invalid child ID', 400);

    const { subjectId } = (req as Request & { validatedQuery?: ChildAnalyticsQuery }).validatedQuery ?? {};

    const data = await parentService.getChildDashboard(parentUserId, childId, subjectId);

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

export async function getChildKnowledgeGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parentUserId = getParentUserId(req);
    const childId = parseInt(req.params.id, 10);
    if (isNaN(childId)) throw new AppError('Invalid child ID', 400);

    const { subjectId } = (req as Request & { validatedQuery?: ChildAnalyticsQuery }).validatedQuery ?? {};

    const data = await parentService.getChildKnowledgeGraph(parentUserId, childId, subjectId);

    res.json({
      success: true,
      message: 'Child knowledge graph retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getChildLearningPath(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parentUserId = getParentUserId(req);
    const childId = parseInt(req.params.id, 10);
    if (isNaN(childId)) throw new AppError('Invalid child ID', 400);

    const { targetNodeId } = (req as Request & { validatedQuery?: ChildLearningPathQuery })
      .validatedQuery ?? { targetNodeId: NaN };

    const data = await parentService.getChildLearningPath(parentUserId, childId, targetNodeId);

    res.json({
      success: true,
      message: 'Child learning path retrieved',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

