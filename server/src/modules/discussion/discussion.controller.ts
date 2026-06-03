import type { Request, Response, NextFunction } from 'express';
import { discussionService } from './discussion.service';
import { AppError } from '../../middlewares/errorHandler';
import type { ListDiscussionsQuery } from './discussion.validation';

function getQuery(req: Request): ListDiscussionsQuery {
  return (
    (req as Request & { validatedQuery?: ListDiscussionsQuery }).validatedQuery ??
    ({ page: 1, limit: 20 } as ListDiscussionsQuery)
  );
}

function getUploadedFiles(req: Request): Express.Multer.File[] {
  return Array.isArray(req.files) ? req.files : [];
}

export async function listDiscussions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const result = await discussionService.listDiscussions(getQuery(req), req.user.id, req.user.role);
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getDiscussion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid discussion ID', 400);
    const data = await discussionService.getDiscussion(id, req.user.id, req.user.role);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function createDiscussion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const data = await discussionService.createDiscussion(
      req.body,
      req.user.id,
      req.user.role,
      getUploadedFiles(req),
    );
    res.status(201).json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateDiscussion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid discussion ID', 400);
    const data = await discussionService.updateDiscussion(id, req.body, req.user.id, req.user.role);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function deleteDiscussion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid discussion ID', 400);
    const data = await discussionService.deleteDiscussion(id, req.user.id, req.user.role);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function createReply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid discussion ID', 400);
    const data = await discussionService.createReply(
      id,
      req.body,
      req.user.id,
      req.user.role,
      getUploadedFiles(req),
    );
    res.status(201).json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateReply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.replyId, 10);
    if (isNaN(id)) throw new AppError('Invalid reply ID', 400);
    const data = await discussionService.updateReply(id, req.body, req.user.id, req.user.role);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function deleteReply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.replyId, 10);
    if (isNaN(id)) throw new AppError('Invalid reply ID', 400);
    const data = await discussionService.deleteReply(id, req.user.id, req.user.role);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function adminListDiscussions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const result = await discussionService.adminListDiscussions(getQuery(req));
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getAttachmentDownloadUrl(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.attachmentId, 10);
    if (isNaN(id)) throw new AppError('Invalid attachment ID', 400);
    const data = await discussionService.getAttachmentDownloadUrl(id, req.user.id, req.user.role);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
