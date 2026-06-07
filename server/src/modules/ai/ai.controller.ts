import type { Request, Response, NextFunction } from 'express';

import { AppError } from '../../middlewares/errorHandler';
import { aiService } from './ai.service';

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
