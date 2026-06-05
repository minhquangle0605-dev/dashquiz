import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { questionQualityService, REVIEW_STATUSES } from './questionQuality.service';
import { AppError } from '../../middlewares/errorHandler';

export const reviewStatusSchema = z.object({
  status: z.enum(REVIEW_STATUSES),
  qualityFlag: z.string().max(30).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});

function parseQuestionId(req: Request): number {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) throw new AppError('Invalid question ID', 400);
  return id;
}

export async function getQuality(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const data = await questionQualityService.getQuality(parseQuestionId(req));
    res.json({ success: true, message: 'Question quality retrieved', data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function setReviewStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const data = await questionQualityService.setReview(parseQuestionId(req), req.user.id, req.body);
    res.json({ success: true, message: 'Question review saved', data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
