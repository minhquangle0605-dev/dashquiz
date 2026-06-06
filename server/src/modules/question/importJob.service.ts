import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { questionService } from './question.service';
import {
  storeImportFile,
  fetchImportFile,
  deleteImportFile,
} from './import.storage';
import {
  detectSourceFormat,
  parseImportFile,
  type ImportSourceFormat,
  type ParseResult,
} from './importParsers';
import {
  validateImportQuestion,
  isCommittable,
  type NormalizedImportQuestion,
  type ValidationResult,
} from './importValidation';
import { findDuplicateQuestions } from './questionDedup.service';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT JOB SERVICE (PDF §6 wizard + §9 API + §19 build order #1/#2)
//
// One ImportJob = one upload attempt. The original file is stored in MinIO, the
// file is parsed + validated in the background (in-process, no extra queue infra)
// into ImportPreviewItem rows, and nothing reaches the question bank until the
// teacher commits. Critical validation errors block an item from being committed.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RECENT_JOBS = 50;

type JobStatus = 'PENDING' | 'PARSING' | 'READY' | 'COMMITTING' | 'COMPLETED' | 'FAILED';
type ItemStatus = 'PENDING' | 'VALID' | 'INVALID' | 'SKIPPED' | 'COMMITTED';

export interface CreateJobMeta {
  subjectId?: number | null;
  chapterId?: number | null;
  topicId?: number | null;
}

export interface UploadedFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
}

// ── HTML image folding (mirrors the client + ZIP importer) ──────────────────────

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Merge a stored image URL into rich-HTML content for saving. */
function withImage(text: string, url?: string | null): string {
  const trimmed = (text || '').trim();
  if (!url) return trimmed;
  const img = `<img src="${escapeHtmlAttribute(url)}" alt="question image" />`;
  return trimmed ? `${trimmed}<br/>${img}` : img;
}

/** Convert a normalized preview question into the bulk-create payload shape. */
function toBulkPayload(q: NormalizedImportQuestion) {
  const flat = q.questionType === 'SHORT_ANSWER' || q.questionType === 'MATCHING';
  return {
    content: withImage(q.content, q.questionImageUrl),
    questionType: q.questionType,
    difficulty: q.difficulty,
    explanation:
      q.explanation || q.explanationImageUrl
        ? withImage(q.explanation ?? '', q.explanationImageUrl)
        : null,
    options: q.options.map((o) => ({
      label: o.label,
      content: withImage(o.content, o.imageUrl),
      isCorrect: flat ? true : o.isCorrect,
    })),
  };
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function readNormalized(value: Prisma.JsonValue): NormalizedImportQuestion {
  return value as unknown as NormalizedImportQuestion;
}

function readValidation(value: Prisma.JsonValue): ValidationResult {
  return (value as unknown as ValidationResult) ?? { critical: [], warnings: [], confidence: 0 };
}

class ImportJobService {
  // ── Create + background processing ──────────────────────────────────────────

  async createJob(file: UploadedFile, meta: CreateJobMeta, userId: number) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new AppError('Uploaded file is empty', 400);
    }
    const filename = file.originalname || 'upload';
    const format = detectSourceFormat(file.mimetype || '', filename);

    let sourceObject: string | null = null;
    try {
      sourceObject = await storeImportFile(userId, file);
    } catch (error) {
      // Storing the original is best-effort (used for retry/audit). Parsing can
      // still proceed from the in-memory buffer if storage is unavailable.
      logger.warn(`Import job: could not store original file: ${(error as Error).message}`);
    }

    const job = await prisma.importJob.create({
      data: {
        fileName: filename.slice(0, 255),
        fileType: (file.mimetype || 'application/octet-stream').slice(0, 100),
        sourceFormat: format,
        sourceObject,
        status: 'PENDING',
        subjectId: meta.subjectId ?? null,
        chapterId: meta.chapterId ?? null,
        topicId: meta.topicId ?? null,
        createdBy: userId,
      },
    });

    // Fire-and-forget: parse + validate without blocking the upload response.
    this.runProcess(job.id, file.buffer, file.mimetype || '', filename, format, userId);

    return job;
  }

  private runProcess(
    jobId: number,
    buffer: Buffer,
    mimetype: string,
    filename: string,
    format: ImportSourceFormat,
    userId: number,
  ): void {
    void this.processJob(jobId, buffer, mimetype, filename, format, userId).catch(async (error) => {
      logger.error(`Import job ${jobId} processing crashed: ${(error as Error).message}`);
      await this.failJob(jobId, 'Unexpected error while processing the import.').catch(() => undefined);
    });
  }

  private async processJob(
    jobId: number,
    buffer: Buffer,
    mimetype: string,
    filename: string,
    format: ImportSourceFormat,
    userId: number,
  ): Promise<void> {
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'PARSING', progress: 10, errorMessage: null },
    });

    let parsed: ParseResult;
    try {
      parsed = await parseImportFile(format, buffer, mimetype, filename, userId);
    } catch (error) {
      const message =
        error instanceof AppError ? error.message : 'Failed to read the uploaded file.';
      await this.failJob(jobId, message);
      return;
    }

    await prisma.importJob.update({ where: { id: jobId }, data: { progress: 70 } });

    // Scope duplicate detection to the job's chosen subject/chapter (if any).
    const jobMeta = await prisma.importJob.findUnique({
      where: { id: jobId },
      select: { subjectId: true, chapterId: true },
    });

    let valid = 0;
    let invalid = 0;
    let warningCount = 0;

    const itemsData: Prisma.ImportPreviewItemCreateManyInput[] = [];
    for (let index = 0; index < parsed.items.length; index += 1) {
      const item = parsed.items[index];
      const result = validateImportQuestion(item.question, item.baseConfidence);
      const status: ItemStatus = isCommittable(result) ? 'VALID' : 'INVALID';
      if (status === 'VALID') valid += 1;
      else invalid += 1;
      warningCount += result.warnings.length;

      // Best-effort duplicate lookup against the existing bank (never blocks).
      let duplicateJson: Prisma.InputJsonValue | undefined;
      try {
        const matches = await findDuplicateQuestions(item.question.content, {
          subjectId: jobMeta?.subjectId ?? undefined,
          chapterId: jobMeta?.chapterId ?? undefined,
          limit: 3,
        });
        if (matches.length > 0) duplicateJson = asJson({ matches });
      } catch (error) {
        logger.warn(`Import job ${jobId}: duplicate lookup failed: ${(error as Error).message}`);
      }

      itemsData.push({
        importJobId: jobId,
        orderIndex: index,
        rawText: item.rawText,
        normalizedJson: asJson(item.question),
        validationJson: asJson(result),
        duplicateJson,
        confidence: result.confidence,
        sourcePage: item.sourcePage,
        sourceLine: item.sourceLine,
        status,
      });
    }

    await prisma.$transaction([
      prisma.importPreviewItem.createMany({ data: itemsData }),
      prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'READY',
          progress: 100,
          totalItems: itemsData.length,
          validItems: valid,
          invalidItems: invalid,
          warningCount,
          parserSource: parsed.parserSource.slice(0, 20),
        },
      }),
    ]);

    if (parsed.warnings.length > 0) {
      logger.info(`Import job ${jobId} warnings: ${parsed.warnings.join('; ')}`);
    }
  }

  private async failJob(jobId: number, message: string): Promise<void> {
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: message.slice(0, 2000) },
    });
  }

  // ── Read ─────────────────────────────────────────────────────────────────────

  private async loadOwnedJob(jobId: number, userId: number, isAdmin: boolean) {
    const job = await prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job || (!isAdmin && job.createdBy !== userId)) {
      throw new AppError('Import job not found', 404);
    }
    return job;
  }

  async getJob(jobId: number, userId: number, isAdmin: boolean) {
    return this.loadOwnedJob(jobId, userId, isAdmin);
  }

  async listJobs(userId: number, isAdmin: boolean) {
    return prisma.importJob.findMany({
      where: isAdmin ? {} : { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_RECENT_JOBS,
    });
  }

  async getPreview(jobId: number, userId: number, isAdmin: boolean) {
    const job = await this.loadOwnedJob(jobId, userId, isAdmin);
    const items = await prisma.importPreviewItem.findMany({
      where: { importJobId: jobId },
      orderBy: { orderIndex: 'asc' },
    });
    return { job, items };
  }

  // ── Edit one preview item ──────────────────────────────────────────────────────

  async updatePreviewItem(
    itemId: number,
    question: NormalizedImportQuestion,
    userId: number,
    isAdmin: boolean,
  ) {
    const item = await prisma.importPreviewItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError('Preview item not found', 404);
    const job = await this.loadOwnedJob(item.importJobId, userId, isAdmin);
    if (item.status === 'COMMITTED') {
      throw new AppError('This question is already saved and can no longer be edited here', 400);
    }

    const base = readNormalized(item.normalizedJson);
    const baseConfidence = readValidation(item.validationJson).confidence;
    const merged: NormalizedImportQuestion = { ...base, ...question };
    const result = validateImportQuestion(merged, Math.max(baseConfidence, 0.9));
    const status: ItemStatus = isCommittable(result) ? 'VALID' : 'INVALID';

    const updated = await prisma.importPreviewItem.update({
      where: { id: itemId },
      data: {
        normalizedJson: asJson(merged),
        validationJson: asJson(result),
        confidence: result.confidence,
        status,
      },
    });
    await this.refreshCounts(job.id);
    return updated;
  }

  // ── Re-run validation across the job ────────────────────────────────────────────

  async revalidate(jobId: number, userId: number, isAdmin: boolean) {
    await this.loadOwnedJob(jobId, userId, isAdmin);
    const items = await prisma.importPreviewItem.findMany({
      where: { importJobId: jobId, status: { in: ['PENDING', 'VALID', 'INVALID'] } },
    });
    await prisma.$transaction(
      items.map((item) => {
        const result = validateImportQuestion(readNormalized(item.normalizedJson), item.confidence);
        return prisma.importPreviewItem.update({
          where: { id: item.id },
          data: {
            validationJson: asJson(result),
            confidence: result.confidence,
            status: isCommittable(result) ? 'VALID' : 'INVALID',
          },
        });
      }),
    );
    await this.refreshCounts(jobId);
    return this.getPreview(jobId, userId, isAdmin);
  }

  // ── Bulk repair (PDF §6 step 4) ──────────────────────────────────────────────────

  async bulkFix(
    jobId: number,
    action: {
      type: 'set-difficulty' | 'set-type' | 'set-taxonomy' | 'skip-invalid' | 'skip';
      difficulty?: number;
      questionType?: NormalizedImportQuestion['questionType'];
      subjectId?: number | null;
      chapterId?: number | null;
      topicId?: number | null;
      itemIds?: number[];
    },
    userId: number,
    isAdmin: boolean,
  ) {
    await this.loadOwnedJob(jobId, userId, isAdmin);

    if (action.type === 'set-taxonomy') {
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          subjectId: action.subjectId ?? null,
          chapterId: action.chapterId ?? null,
          topicId: action.topicId ?? null,
        },
      });
      return this.getPreview(jobId, userId, isAdmin);
    }

    const editableStatuses: ItemStatus[] = ['PENDING', 'VALID', 'INVALID'];
    const where: Prisma.ImportPreviewItemWhereInput = {
      importJobId: jobId,
      status: { in: editableStatuses },
      ...(action.itemIds && action.itemIds.length > 0 ? { id: { in: action.itemIds } } : {}),
    };
    const items = await prisma.importPreviewItem.findMany({ where });

    if (action.type === 'skip-invalid' || action.type === 'skip') {
      const skipIds =
        action.type === 'skip-invalid'
          ? items.filter((i) => i.status === 'INVALID').map((i) => i.id)
          : items.map((i) => i.id);
      if (skipIds.length > 0) {
        await prisma.importPreviewItem.updateMany({
          where: { id: { in: skipIds } },
          data: { status: 'SKIPPED' },
        });
      }
      await this.refreshCounts(jobId);
      return this.getPreview(jobId, userId, isAdmin);
    }

    await prisma.$transaction(
      items.map((item) => {
        const q = readNormalized(item.normalizedJson);
        if (action.type === 'set-difficulty' && action.difficulty) {
          q.difficulty = action.difficulty;
        }
        if (action.type === 'set-type' && action.questionType) {
          q.questionType = action.questionType;
        }
        const result = validateImportQuestion(q, item.confidence);
        return prisma.importPreviewItem.update({
          where: { id: item.id },
          data: {
            normalizedJson: asJson(q),
            validationJson: asJson(result),
            confidence: result.confidence,
            status: isCommittable(result) ? 'VALID' : 'INVALID',
          },
        });
      }),
    );
    await this.refreshCounts(jobId);
    return this.getPreview(jobId, userId, isAdmin);
  }

  // ── Commit selected items into the question bank ─────────────────────────────────

  async commit(
    jobId: number,
    selectedItemIds: number[] | null,
    userId: number,
    isAdmin: boolean,
  ) {
    const job = await this.loadOwnedJob(jobId, userId, isAdmin);
    if (!job.subjectId || !job.chapterId) {
      throw new AppError('Choose a subject and chapter before saving questions', 400);
    }

    const candidates = await prisma.importPreviewItem.findMany({
      where: {
        importJobId: jobId,
        status: { in: ['PENDING', 'VALID'] },
        ...(selectedItemIds && selectedItemIds.length > 0 ? { id: { in: selectedItemIds } } : {}),
      },
      orderBy: { orderIndex: 'asc' },
    });

    if (candidates.length === 0) {
      throw new AppError('No valid questions are selected to save', 400);
    }

    // Only commit items that still pass validation; report the rest as skipped.
    const committable = candidates.filter((item) =>
      isCommittable(validateImportQuestion(readNormalized(item.normalizedJson), item.confidence)),
    );
    const skipped = candidates.length - committable.length;

    if (committable.length === 0) {
      throw new AppError('All selected questions still have critical errors to fix', 400);
    }

    await prisma.importJob.update({ where: { id: jobId }, data: { status: 'COMMITTING' } });

    let result;
    try {
      const payloads = committable.map((item) => toBulkPayload(readNormalized(item.normalizedJson)));
      result = await questionService.bulkCreate(
        payloads,
        {
          subjectId: job.subjectId,
          chapterId: job.chapterId,
          topicId: job.topicId ?? undefined,
        },
        userId,
      );
    } catch (error) {
      await prisma.importJob.update({ where: { id: jobId }, data: { status: 'READY' } });
      throw error;
    }

    const createdIds: number[] = result.data?.createdIds ?? [];
    // createdIds preserve the input order of the items bulkCreate accepted.
    await prisma.$transaction(
      committable.map((item, index) =>
        prisma.importPreviewItem.update({
          where: { id: item.id },
          data: {
            status: 'COMMITTED',
            questionId: createdIds[index] ?? null,
          },
        }),
      ),
    );

    await this.refreshCounts(jobId);
    const remaining = await prisma.importPreviewItem.count({
      where: { importJobId: jobId, status: { in: ['PENDING', 'VALID'] } },
    });
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: remaining === 0 ? 'COMPLETED' : 'READY',
        completedAt: remaining === 0 ? new Date() : job.completedAt,
      },
    });

    return {
      imported: result.data?.imported ?? 0,
      failed: result.data?.failed ?? 0,
      skipped,
      total: candidates.length,
      errors: result.data?.errors ?? null,
    };
  }

  // ── Retry a failed/abandoned job (re-parse the stored original) ──────────────────

  async retryJob(jobId: number, userId: number, isAdmin: boolean) {
    const job = await this.loadOwnedJob(jobId, userId, isAdmin);
    if (!job.sourceObject) {
      throw new AppError('The original file is no longer available to retry', 400);
    }
    if (job.status === 'COMMITTING' || job.status === 'PARSING') {
      throw new AppError('This import is still being processed', 400);
    }

    let buffer: Buffer;
    try {
      buffer = await fetchImportFile(job.sourceObject);
    } catch {
      throw new AppError('Could not read the stored file to retry', 400);
    }

    // Drop any non-committed preview items so the re-parse starts clean. Already
    // committed questions are kept (they are real bank questions now).
    await prisma.importPreviewItem.deleteMany({
      where: { importJobId: jobId, status: { not: 'COMMITTED' } },
    });
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        progress: 0,
        totalItems: 0,
        validItems: 0,
        invalidItems: 0,
        warningCount: 0,
        errorMessage: null,
      },
    });

    this.runProcess(
      jobId,
      buffer,
      job.fileType,
      job.fileName,
      job.sourceFormat as ImportSourceFormat,
      userId,
    );
    return prisma.importJob.findUnique({ where: { id: jobId } });
  }

  // ── Delete a job and its stored file ─────────────────────────────────────────────

  async deleteJob(jobId: number, userId: number, isAdmin: boolean) {
    const job = await this.loadOwnedJob(jobId, userId, isAdmin);
    await prisma.importJob.delete({ where: { id: jobId } });
    await deleteImportFile(job.sourceObject);
    return { success: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────────

  private async refreshCounts(jobId: number): Promise<void> {
    const items = await prisma.importPreviewItem.findMany({
      where: { importJobId: jobId },
      select: { status: true, validationJson: true },
    });
    const validItems = items.filter((i) => i.status === 'VALID').length;
    const invalidItems = items.filter((i) => i.status === 'INVALID').length;
    const importedCount = items.filter((i) => i.status === 'COMMITTED').length;
    const warningCount = items.reduce(
      (n, i) => n + (readValidation(i.validationJson).warnings?.length ?? 0),
      0,
    );
    await prisma.importJob.update({
      where: { id: jobId },
      data: { totalItems: items.length, validItems, invalidItems, importedCount, warningCount },
    });
  }
}

export const importJobService = new ImportJobService();
export type { JobStatus, ItemStatus };
