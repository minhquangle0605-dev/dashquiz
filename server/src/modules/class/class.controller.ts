import type { Request, Response, NextFunction } from 'express';

import { classService } from './class.service';

export async function listClasses(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await classService.listClasses();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
