import type { Request, Response, NextFunction } from 'express';

import { parentService } from './parent.service';
import { AppError } from '../../middlewares/errorHandler';
import type { ChildResultsQuery, ChildAnalyticsQuery } from './parent.validation';

export async function linkStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parentId = req.user!.id;
    const { code, relationship } = req.body;

    const data = await parentService.linkStudent(parentId, { code, relationship });

    res.status(201).json({
      success: true,
      message: 'Student linked successfully',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getChildren(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parentId = req.user!.id;
    const data = await parentService.getChildren(parentId);

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
    const parentId = req.user!.id;
    const childId = parseInt(req.params.id, 10);

    if (isNaN(childId)) {
      throw new AppError('Invalid child ID', 400);
    }

    const query = (req as Request & { validatedQuery?: ChildResultsQuery }).validatedQuery ?? {
      page: 1,
      limit: 20,
      sort: 'date' as const,
      order: 'desc' as const,
    };

    const result = await parentService.getChildResults(parentId, childId, query);

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
    const parentId = req.user!.id;
    const childId = parseInt(req.params.id, 10);

    if (isNaN(childId)) {
      throw new AppError('Invalid child ID', 400);
    }

    const { subjectId } = (req as Request & { validatedQuery?: ChildAnalyticsQuery }).validatedQuery ?? {};

    const data = await parentService.getChildDashboard(parentId, childId, subjectId);

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
    const parentId = req.user!.id;
    const childId = parseInt(req.params.id, 10);

    if (isNaN(childId)) {
      throw new AppError('Invalid child ID', 400);
    }

    const { subjectId } = (req as Request & { validatedQuery?: ChildAnalyticsQuery }).validatedQuery ?? {};

    const data = await parentService.getChildStrengths(parentId, childId, subjectId);

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

export async function generateLinkCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    if (isNaN(studentId)) {
      throw new AppError('Invalid student ID', 400);
    }

    const data = await parentService.generateLinkCode(studentId);

    res.json({
      success: true,
      message: 'Link code generated successfully',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
