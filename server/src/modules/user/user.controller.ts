import type { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { AppError } from '../../middlewares/errorHandler';
import type { ListUsersQuery } from './user.validation';

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const result = await userService.getProfile(req.user.id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const result = await userService.updateProfile(req.user.id, req.body);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const result = await userService.changePassword(req.user.id, req.body);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function uploadAvatar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const result = await userService.uploadAvatar(req.user.id, req.file as Express.Multer.File);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// ADMIN — User Management Controllers (UC37–39)
// ═══════════════════════════════════════════════

export async function adminListUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await userService.listUsers(req.query as unknown as ListUsersQuery);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function adminCreateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await userService.adminCreateUser(req.body);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function adminUpdateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      throw new AppError('Invalid user ID', 400);
    }
    const result = await userService.adminUpdateUser(userId, req.body);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function adminDeleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      throw new AppError('Invalid user ID', 400);
    }
    const result = await userService.adminSoftDeleteUser(userId);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function adminChangeRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      throw new AppError('Invalid user ID', 400);
    }
    const result = await userService.adminChangeRole(userId, req.body);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function adminImportUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await userService.importUsersFromExcel(req.file as Express.Multer.File);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function adminGetImportTemplate(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const buffer = userService.getImportTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=user-import-template.xlsx');
    res.send(buffer);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
