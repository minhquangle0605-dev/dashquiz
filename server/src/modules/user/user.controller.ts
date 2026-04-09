import type { Request, Response, NextFunction } from 'express';

import { userService } from './user.service';

export async function getMe(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await userService.getMe();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateMe(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await userService.updateMe();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
