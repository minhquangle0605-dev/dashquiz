import type { Request, Response, NextFunction } from 'express';

import { adminAnalyticsService } from './adminAnalytics.service';

export async function getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminAnalyticsService.getOverview();
    res.json({ success: true, message: 'Admin analytics overview retrieved', data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getClasses(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminAnalyticsService.getClasses();
    res.json({ success: true, message: 'Admin class comparison retrieved', data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getSubjects(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminAnalyticsService.getSubjects();
    res.json({ success: true, message: 'Admin subject trends retrieved', data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
