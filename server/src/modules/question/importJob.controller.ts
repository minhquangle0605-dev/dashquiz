import type { Request, Response, NextFunction } from 'express';
import { importJobService } from './importJob.service';
import { questionService } from './question.service';
import { findDuplicateClusters, recordDuplicateDecision } from './questionDedup.service';
import { AppError } from '../../middlewares/errorHandler';
import { ROLES } from '../../utils/constants';
import type { NormalizedImportQuestion } from './importValidation';

function isAdminRole(req: Request): boolean {
  return req.user?.role === ROLES.ADMIN;
}

function requireUser(req: Request): { id: number; isAdmin: boolean } {
  if (!req.user) throw new AppError('Authentication required', 401);
  return { id: req.user.id, isAdmin: isAdminRole(req) };
}

function parseJobId(req: Request): number {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) throw new AppError('Invalid import job ID', 400);
  return id;
}

function optionalId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const QUESTION_KINDS = new Set([
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'MATCHING',
]);

/** Coerce an untrusted client payload into a NormalizedImportQuestion. */
function coerceQuestion(raw: unknown): NormalizedImportQuestion {
  const q = (raw ?? {}) as Record<string, unknown>;
  const kind = String(q.questionType ?? 'SINGLE_CHOICE');
  if (!QUESTION_KINDS.has(kind)) throw new AppError('Invalid question type', 400);
  const optionsRaw = Array.isArray(q.options) ? q.options : [];
  return {
    content: String(q.content ?? ''),
    questionType: kind as NormalizedImportQuestion['questionType'],
    difficulty: Number(q.difficulty ?? 3),
    explanation:
      q.explanation === null || q.explanation === undefined ? null : String(q.explanation),
    options: optionsRaw.map((o, idx) => {
      const opt = (o ?? {}) as Record<string, unknown>;
      return {
        label: String(opt.label ?? String.fromCharCode(65 + idx)).toUpperCase().slice(0, 1),
        content: String(opt.content ?? ''),
        isCorrect: Boolean(opt.isCorrect),
        imageUrl:
          opt.imageUrl === null || opt.imageUrl === undefined ? null : String(opt.imageUrl),
      };
    }),
    questionImageUrl:
      q.questionImageUrl === null || q.questionImageUrl === undefined
        ? null
        : String(q.questionImageUrl),
    explanationImageUrl:
      q.explanationImageUrl === null || q.explanationImageUrl === undefined
        ? null
        : String(q.explanationImageUrl),
  };
}

// POST /api/questions/import-jobs
export async function createImportJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = requireUser(req);
    if (!req.file) throw new AppError('A file is required', 400);
    const job = await importJobService.createJob(
      { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype },
      {
        subjectId: optionalId(req.body?.subjectId),
        chapterId: optionalId(req.body?.chapterId),
        topicId: optionalId(req.body?.topicId),
      },
      id,
    );
    res.status(201).json({ success: true, message: 'Import started', data: job });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// GET /api/questions/import-jobs
export async function listImportJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, isAdmin } = requireUser(req);
    const jobs = await importJobService.listJobs(id, isAdmin);
    res.json({ success: true, data: jobs });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// GET /api/questions/import-jobs/:id
export async function getImportJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, isAdmin } = requireUser(req);
    const job = await importJobService.getJob(parseJobId(req), id, isAdmin);
    res.json({ success: true, data: job });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// GET /api/questions/import-jobs/:id/preview
export async function getImportJobPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, isAdmin } = requireUser(req);
    const data = await importJobService.getPreview(parseJobId(req), id, isAdmin);
    res.json({ success: true, data });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// PUT /api/questions/import-preview/:itemId
export async function updateImportPreviewItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, isAdmin } = requireUser(req);
    const itemId = parseInt(req.params.itemId, 10);
    if (Number.isNaN(itemId)) throw new AppError('Invalid preview item ID', 400);
    const question = coerceQuestion(req.body?.question);
    const item = await importJobService.updatePreviewItem(itemId, question, id, isAdmin);
    res.json({ success: true, data: item });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// POST /api/questions/import-jobs/:id/bulk-fix
export async function bulkFixImportJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, isAdmin } = requireUser(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const type = String(body.type ?? '');
    if (!['set-difficulty', 'set-type', 'set-taxonomy', 'skip-invalid', 'skip'].includes(type)) {
      throw new AppError('Invalid bulk-fix action', 400);
    }
    const data = await importJobService.bulkFix(
      parseJobId(req),
      {
        type: type as 'set-difficulty' | 'set-type' | 'set-taxonomy' | 'skip-invalid' | 'skip',
        difficulty: body.difficulty !== undefined ? Number(body.difficulty) : undefined,
        questionType:
          body.questionType !== undefined
            ? (coerceQuestion({ questionType: body.questionType, options: [] }).questionType)
            : undefined,
        subjectId: optionalId(body.subjectId),
        chapterId: optionalId(body.chapterId),
        topicId: optionalId(body.topicId),
        itemIds: Array.isArray(body.itemIds) ? body.itemIds.map((v) => Number(v)) : undefined,
      },
      id,
      isAdmin,
    );
    res.json({ success: true, data });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// POST /api/questions/import-jobs/:id/validate
export async function revalidateImportJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, isAdmin } = requireUser(req);
    const data = await importJobService.revalidate(parseJobId(req), id, isAdmin);
    res.json({ success: true, data });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// POST /api/questions/import-jobs/:id/commit
export async function commitImportJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, isAdmin } = requireUser(req);
    const itemIds = Array.isArray(req.body?.itemIds)
      ? req.body.itemIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isInteger(n))
      : null;
    const result = await importJobService.commit(parseJobId(req), itemIds, id, isAdmin);
    res.json({
      success: true,
      message: `Saved ${result.imported} question(s)`,
      data: result,
    });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// POST /api/questions/import-jobs/:id/retry
export async function retryImportJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, isAdmin } = requireUser(req);
    const job = await importJobService.retryJob(parseJobId(req), id, isAdmin);
    res.json({ success: true, message: 'Retry started', data: job });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// DELETE /api/questions/import-jobs/:id
export async function deleteImportJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, isAdmin } = requireUser(req);
    await importJobService.deleteJob(parseJobId(req), id, isAdmin);
    res.json({ success: true, message: 'Import job deleted' });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// GET /api/questions/duplicates — near-duplicate pairs already in the bank.
export async function listDuplicateClusters(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireUser(req);
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
    const threshold = req.query.threshold ? Number(req.query.threshold) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const pairs = await findDuplicateClusters({ subjectId, threshold, limit });
    res.json({ success: true, data: pairs });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// POST /api/questions/duplicates/resolve — keep both / dismiss / delete one.
export async function resolveDuplicate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = requireUser(req);
    const questionId = Number(req.body?.questionId);
    const duplicateQuestionId = Number(req.body?.duplicateQuestionId);
    const action = String(req.body?.action ?? '');
    if (!Number.isInteger(questionId) || !Number.isInteger(duplicateQuestionId)) {
      throw new AppError('questionId and duplicateQuestionId are required', 400);
    }
    if (action === 'delete') {
      await questionService.bulkDelete([duplicateQuestionId]);
    } else if (action === 'acceptable') {
      await recordDuplicateDecision(questionId, duplicateQuestionId, 'acceptable', id);
    } else if (action === 'dismiss') {
      await recordDuplicateDecision(questionId, duplicateQuestionId, 'dismissed', id);
    } else {
      throw new AppError('Invalid action. Use acceptable, dismiss, or delete.', 400);
    }
    res.json({ success: true, message: 'Duplicate resolved' });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
