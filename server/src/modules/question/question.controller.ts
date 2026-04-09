import type { Request, Response, NextFunction } from 'express';

import { questionService } from './question.service';

export async function listQuestions(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await questionService.listQuestions();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
