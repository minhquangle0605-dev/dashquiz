import type { Request, Response, NextFunction } from 'express';

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
