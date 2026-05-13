import type { Request, Response, NextFunction } from 'express';
import { questionService } from './question.service';
import {
  generateDocumentImportTemplatePdf,
  questionExtractService,
} from './question.extract.service';
import {
  decodeImageKey,
  getQuestionImageObject,
  uploadQuestionImage,
} from './question.media';
import { AppError } from '../../middlewares/errorHandler';
import type { ListQuestionsQuery } from './question.validation';

// ═══════════════════════════════════════════════
// LIST QUESTIONS (GET /api/questions)
// ═══════════════════════════════════════════════

export async function listQuestions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as ListQuestionsQuery;
    const result = await questionService.listQuestions(query);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// GET QUESTION BY ID (GET /api/questions/:id)
// ═══════════════════════════════════════════════

export async function getQuestion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid question ID', 400);
    const result = await questionService.getQuestionById(id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// CREATE QUESTION (POST /api/questions)
// ═══════════════════════════════════════════════

export async function createQuestion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const result = await questionService.createQuestion(req.body, req.user.id);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// UPDATE QUESTION (PUT /api/questions/:id)
// ═══════════════════════════════════════════════

export async function updateQuestion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid question ID', 400);
    const result = await questionService.updateQuestion(id, req.body);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// DELETE QUESTION (DELETE /api/questions/:id)
// ═══════════════════════════════════════════════

export async function deleteQuestion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid question ID', 400);
    const result = await questionService.deleteQuestion(id);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// BULK DELETE QUESTIONS (POST /api/questions/bulk-delete)
// ═══════════════════════════════════════════════

export async function bulkDeleteQuestions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('Question IDs are required', 400);
    }
    const result = await questionService.bulkDelete(ids);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// IMPORT FROM EXCEL (POST /api/questions/import)
// ═══════════════════════════════════════════════

export async function importQuestions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    if (!req.file) throw new AppError('Excel file is required', 400);

    const meta = {
      subjectId: Number(req.body.subjectId),
      chapterId: Number(req.body.chapterId),
      topicId: Number(req.body.topicId),
    };

    if (!meta.subjectId || !meta.chapterId || !meta.topicId) {
      throw new AppError('subjectId, chapterId, and topicId are required', 400);
    }

    const result = await questionService.importFromExcel(
      req.file.buffer,
      meta,
      req.user.id,
    );
    res.status(result.success ? 201 : 200).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// DOWNLOAD IMPORT TEMPLATE (GET /api/questions/import-template)
// ═══════════════════════════════════════════════

export async function downloadImportTemplate(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buffer = questionService.generateImportTemplate();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=question_import_template.xlsx',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function uploadQuestionImageFile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    if (!req.file) throw new AppError('Image file is required', 400);
    const result = await uploadQuestionImage(req.user.id, req.file);
    res.status(201).json({
      success: true,
      message: 'Question image uploaded successfully',
      data: result,
    });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function serveQuestionImage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const objectName = decodeImageKey(req.params.key);
    const { stream, contentType } = await getQuestionImageObject(objectName);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    stream.pipe(res);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function exportQuestionsGift(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id: unknown) => Number(id))
      : [];
    const gift = await questionService.generateGiftExport(ids);
    const filename = `questions_${new Date().toISOString().slice(0, 10)}.gift`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(gift);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function downloadDocumentImportTemplate(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buffer = await generateDocumentImportTemplatePdf();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=question_document_import_template.pdf',
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// EXTRACT QUESTIONS FROM WORD/PDF (POST /api/questions/extract-from-document)
// ═══════════════════════════════════════════════

export async function extractFromDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    if (!req.file) throw new AppError('Document file is required', 400);

    const result = await questionExtractService.extractFromDocument(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname || '',
    );

    res.json({
      success: true,
      message: `Detected ${result.questions.length} question(s)`,
      data: result,
    });
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// BULK CREATE QUESTIONS (POST /api/questions/bulk-create)
// Used after the teacher confirms the extracted preview.
// ═══════════════════════════════════════════════

export async function bulkCreateQuestions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);

    const meta = {
      subjectId: Number(req.body?.subjectId),
      chapterId: Number(req.body?.chapterId),
      topicId: Number(req.body?.topicId),
    };

    if (!meta.subjectId || !meta.chapterId || !meta.topicId) {
      throw new AppError(
        'subjectId, chapterId, and topicId are required',
        400,
      );
    }

    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (questions.length === 0) {
      throw new AppError('No questions to create', 400);
    }

    const result = await questionService.bulkCreate(
      questions,
      meta,
      req.user.id,
    );
    res.status(result.success ? 201 : 200).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// ADD TAGS (POST /api/questions/:id/tags)
// ═══════════════════════════════════════════════

export async function addTags(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid question ID', 400);
    const result = await questionService.addTags(id, req.body);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// REMOVE TAG (DELETE /api/questions/:id/tags/:tagId)
// ═══════════════════════════════════════════════

export async function removeTag(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const tagId = parseInt(req.params.tagId, 10);
    if (isNaN(id) || isNaN(tagId)) throw new AppError('Invalid ID parameter', 400);
    const result = await questionService.removeTag(id, tagId);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
