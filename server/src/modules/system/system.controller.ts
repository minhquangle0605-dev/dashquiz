import type { Request, Response, NextFunction } from 'express';
import { systemService } from './system.service';
import { AppError } from '../../middlewares/errorHandler';
import type { ListActivityLogsQuery, ListBackupsQuery } from './system.validation';

export async function getConfigs(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await systemService.getConfigs();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateConfigs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await systemService.updateConfigs(req.body);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getMonitoring(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await systemService.getMonitoring();
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function listActivityLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await systemService.listActivityLogs(req.query as unknown as ListActivityLogsQuery);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function createBackup(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const result = await systemService.createBackup(req.user.id);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function restoreBackup(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const backupId = parseInt(req.params.id, 10);
    if (isNaN(backupId)) {
      throw new AppError('Invalid backup ID', 400);
    }
    const result = await systemService.restoreBackup(backupId);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function listBackups(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await systemService.listBackups(req.query as unknown as ListBackupsQuery);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
