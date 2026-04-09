import type { Request, Response, NextFunction } from 'express';

import { examService } from './exam.service';

export async function listExams(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await examService.listExams();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
