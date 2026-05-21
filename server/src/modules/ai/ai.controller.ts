import type { Request, Response, NextFunction } from 'express';

import { AppError } from '../../middlewares/errorHandler';
import { aiService } from './ai.service';

export async function startPractice(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await aiService.startPractice();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function generateRemedial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { attemptId } = req.body as { attemptId: number };
    const result = await aiService.generateRemedialPractice(attemptId, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Remedial questions generated',
      data: result,
    });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getRemedialSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const sessionId = parseInt(req.params.id, 10);
    if (Number.isNaN(sessionId)) throw new AppError('Invalid session ID', 400);
    const data = await aiService.getRemedialSession(sessionId, req.user.id);
    res.json({ success: true, data });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function generateMatchingDistractor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const body = req.body as {
      pairs: Array<{ left: string; right: string }>;
      questionContent?: string;
      subjectName?: string;
      topicName?: string;
    };
    const distractor = await aiService.generateMatchingDistractor(body);
    res.json({
      success: true,
      message: 'Distractor generated',
      data: { distractor },
    });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function submitRemedialAnswer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const sessionId = parseInt(req.params.id, 10);
    const questionId = parseInt(req.params.questionId, 10);
    if (Number.isNaN(sessionId) || Number.isNaN(questionId)) {
      throw new AppError('Invalid IDs', 400);
    }
    const { selectedLabel } = req.body as { selectedLabel: string };
    const data = await aiService.submitRemedialAnswer(
      sessionId,
      questionId,
      req.user.id,
      selectedLabel,
    );
    res.json({ success: true, data });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
