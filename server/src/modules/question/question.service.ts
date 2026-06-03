import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { isCoreSubjectCode } from '../../constants/subjects';
import { FILE_UPLOAD, PAGINATION } from '../../utils/constants';
import { cacheGet, cacheSet, cacheInvalidate } from '../../utils/cache';
import { buildPaginationResponse } from '../../utils/pagination';
import {
  objectNameFromQuestionImageSrc,
  readQuestionImageAsDataUri,
} from './question.media';
import type {
  CreateQuestionInput,
  UpdateQuestionInput,
  ListQuestionsQuery,
  AddTagsInput,
  ImportQuestionsInput,
} from './question.validation';

// ═══════════════════════════════════════════════
// EXCEL TEMPLATE HEADERS
// ═══════════════════════════════════════════════

const IMPORT_HEADERS = ['content', 'A', 'B', 'C', 'D', 'correct', 'explanation', 'difficulty'] as const;

interface ExcelRow {
  content?: string;
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  correct?: string;
  explanation?: string;
  difficulty?: number | string;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

type SupportedQuestionKind =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'MATCHING';

type BulkQuestionPayload = {
  content: string;
  questionType: SupportedQuestionKind;
  difficulty: number;
  explanation: string | null;
  options: Array<{ label: string; content: string; isCorrect: boolean }>;
};

const LIST_QUESTIONS_CACHE_TTL = 180; // 3 minutes

const ALLOWED_IMAGE_SRC = /^(data:image\/(png|jpeg|jpg|webp);base64,|https?:\/\/|\/api\/questions\/images\/)/i;

function sanitizeRichQuestionHtml(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(src|href)\s*=\s*(['"])\s*(javascript:|vbscript:)[\s\S]*?\2/gi, '')
    .replace(/<img\b([^>]*)>/gi, (_tag, attrs: string) => {
      const srcMatch = String(attrs).match(/\ssrc\s*=\s*(['"])(.*?)\1/i);
      if (!srcMatch || !ALLOWED_IMAGE_SRC.test(srcMatch[2])) return '';
      const altMatch = String(attrs).match(/\salt\s*=\s*(['"])(.*?)\1/i);
      const src = escapeHtmlAttribute(srcMatch[2]);
      const alt = escapeHtmlAttribute(altMatch?.[2] ?? 'question image');
      return `<img src="${src}" alt="${alt}" />`;
    })
    .trim();
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeGiftText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/~/g, '\\~')
    .replace(/=/g, '\\=')
    .replace(/#/g, '\\#')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/:/g, '\\:');
}

function extractImageSources(html: string): string[] {
  const sources: string[] = [];
  const imgRegex = /<img\b[^>]*\ssrc\s*=\s*(['"])(.*?)\1[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    sources.push(match[2]);
  }
  return sources;
}

export class QuestionService {
  private listQuestionsCacheKey(query: ListQuestionsQuery, page: number, limit: number): string {
    const diff =
      query.difficulty && Array.isArray(query.difficulty) && query.difficulty.length > 0
        ? [...query.difficulty].sort((a, b) => a - b)
        : null;
    return `question:list:${JSON.stringify({
      p: page,
      l: limit,
      s: query.subjectId ?? null,
      g: query.gradeLevel ?? null,
      c: query.chapterId ?? null,
      t: query.topicId ?? null,
      qt: query.questionType ?? null,
      d: diff,
      k: query.keyword ?? null,
    })}`;
  }

  private async invalidateQuestionListCaches(): Promise<void> {
    await cacheInvalidate('question:list:*');
  }

  // ═══════════════════════════════════════════════
  // LIST QUESTIONS (with cascading filters + keyword search + pagination)
  // ═══════════════════════════════════════════════

  async listQuestions(query: ListQuestionsQuery) {
    const page = query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const cacheKey = this.listQuestionsCacheKey(query, page, limit);
    const cached = await cacheGet<{
      success: true;
      message: string;
      data: unknown;
      pagination: ReturnType<typeof buildPaginationResponse>;
    }>(cacheKey);
    if (cached) {
      return cached as never;
    }

    const where: Prisma.QuestionWhereInput = {};

    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.gradeLevel) where.chapter = { gradeLevel: query.gradeLevel };
    if (query.chapterId) where.chapterId = query.chapterId;
    if (query.topicId) where.topicId = query.topicId;
    if (query.questionType) where.questionType = query.questionType;

    if (query.difficulty && Array.isArray(query.difficulty) && query.difficulty.length > 0) {
      where.difficulty = { in: query.difficulty };
    }

    if (query.keyword) {
      where.OR = [
        { content: { contains: query.keyword, mode: 'insensitive' } },
        { explanation: { contains: query.keyword, mode: 'insensitive' } },
        { options: { some: { content: { contains: query.keyword, mode: 'insensitive' } } } },
        { tags: { some: { tagName: { contains: query.keyword, mode: 'insensitive' } } } },
      ];
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        select: {
          id: true,
          subjectId: true,
          chapterId: true,
          topicId: true,
          content: true,
          questionType: true,
          difficulty: true,
          createdBy: true,
          createdAt: true,
          subject: { select: { id: true, name: true, code: true } },
          chapter: { select: { id: true, name: true, gradeLevel: true } },
          topic: { select: { id: true, name: true } },
          options: {
            orderBy: { label: 'asc' },
            select: {
              id: true,
              questionId: true,
              label: true,
              content: true,
              isCorrect: true,
            },
          },
          tags: { select: { id: true, tagName: true } },
          creator: { select: { id: true, fullName: true } },
          _count: { select: { examQuestions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.question.count({ where }),
    ]);

    const result = {
      success: true as const,
      message: 'Questions retrieved successfully',
      data: questions,
      pagination: buildPaginationResponse(total, page, limit),
    };
    await cacheSet(cacheKey, result, LIST_QUESTIONS_CACHE_TTL);
    return result;
  }

  // ═══════════════════════════════════════════════
  // GET QUESTION BY ID
  // ═══════════════════════════════════════════════

  async getQuestionById(id: number) {
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        chapter: { select: { id: true, name: true, gradeLevel: true } },
        topic: { select: { id: true, name: true } },
        options: { orderBy: { label: 'asc' } },
        tags: { select: { id: true, tagName: true } },
        creator: { select: { id: true, fullName: true } },
        _count: { select: { examQuestions: true } },
      },
    });

    if (!question) {
      throw new AppError('Question not found', 404);
    }

    return {
      success: true,
      message: 'Question retrieved successfully',
      data: question,
    };
  }

  // ═══════════════════════════════════════════════
  // CREATE QUESTION (with 4 options)
  // ═══════════════════════════════════════════════

  async createQuestion(data: CreateQuestionInput, userId: number) {
    const topicId = await this.resolveImportTopicId(
      data.subjectId,
      data.chapterId,
      data.topicId,
    );

    const question = await prisma.question.create({
      data: {
        subjectId: data.subjectId,
        chapterId: data.chapterId,
        topicId,
        content: sanitizeRichQuestionHtml(data.content),
        questionType: data.questionType,
        difficulty: data.difficulty,
        explanation: data.explanation ? sanitizeRichQuestionHtml(data.explanation) : null,
        createdBy: userId,
        options: {
          create: data.options.map((opt) => ({
            label: opt.label,
            content: sanitizeRichQuestionHtml(opt.content),
            isCorrect: opt.isCorrect,
          })),
        },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        chapter: { select: { id: true, name: true, gradeLevel: true } },
        topic: { select: { id: true, name: true } },
        options: { orderBy: { label: 'asc' } },
        tags: true,
      },
    });

    await this.invalidateQuestionListCaches();

    return {
      success: true,
      message: 'Question created successfully',
      data: question,
    };
  }

  // ═══════════════════════════════════════════════
  // UPDATE QUESTION
  // ═══════════════════════════════════════════════

  async updateQuestion(id: number, data: UpdateQuestionInput) {
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Question not found', 404);
    }

    const subjectId = data.subjectId ?? existing.subjectId;
    const chapterId = data.chapterId ?? existing.chapterId;
    let topicId = existing.topicId;
    const curriculumChanged =
      data.subjectId !== undefined ||
      data.chapterId !== undefined ||
      data.topicId !== undefined;

    if (curriculumChanged) {
      topicId = await this.resolveImportTopicId(subjectId, chapterId, data.topicId);
    }

    const question = await prisma.$transaction(async (tx) => {
      if (data.options) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        await tx.questionOption.createMany({
          data: data.options.map((opt) => ({
            questionId: id,
            label: opt.label,
            content: sanitizeRichQuestionHtml(opt.content),
            isCorrect: opt.isCorrect,
          })),
        });
      }

      return tx.question.update({
        where: { id },
        data: {
          ...(data.content !== undefined && { content: sanitizeRichQuestionHtml(data.content) }),
          ...(data.questionType !== undefined && { questionType: data.questionType }),
          ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
          ...(data.explanation !== undefined && {
            explanation: data.explanation ? sanitizeRichQuestionHtml(data.explanation) : null,
          }),
          ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
          ...(data.chapterId !== undefined && { chapterId: data.chapterId }),
          ...(curriculumChanged && { topicId }),
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          chapter: { select: { id: true, name: true, gradeLevel: true } },
          topic: { select: { id: true, name: true } },
          options: { orderBy: { label: 'asc' } },
          tags: { select: { id: true, tagName: true } },
        },
      });
    });

    await this.invalidateQuestionListCaches();

    return {
      success: true,
      message: 'Question updated successfully',
      data: question,
    };
  }

  // ═══════════════════════════════════════════════
  // DELETE QUESTION (check not in active exam)
  // ═══════════════════════════════════════════════

  async deleteQuestion(id: number) {
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        examQuestions: {
          include: {
            exam: { select: { id: true, title: true, status: true } },
          },
        },
      },
    });

    if (!question) {
      throw new AppError('Question not found', 404);
    }

    const activeExams = question.examQuestions.filter(
      (eq) => eq.exam.status === 'PUBLISHED' || eq.exam.status === 'SCHEDULED',
    );

    if (activeExams.length > 0) {
      const examTitles = activeExams.map((eq) => eq.exam.title).join(', ');
      throw new AppError(
        `Cannot delete: question is used in active exam(s): ${examTitles}`,
        409,
      );
    }

    await prisma.question.delete({ where: { id } });

    await this.invalidateQuestionListCaches();

    return {
      success: true,
      message: 'Question deleted successfully',
      data: null,
    };
  }

  // ═══════════════════════════════════════════════
  // BULK DELETE QUESTIONS
  // ═══════════════════════════════════════════════

  async bulkDelete(ids: number[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('No question IDs provided', 400);
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: ids } },
      include: {
        examQuestions: {
          include: {
            exam: { select: { id: true, title: true, status: true } },
          },
        },
      },
    });

    if (questions.length === 0) {
      throw new AppError('No questions found to delete', 404);
    }

    const activeExams = questions.flatMap(q => q.examQuestions)
      .filter(eq => eq.exam.status === 'PUBLISHED' || eq.exam.status === 'SCHEDULED');

    if (activeExams.length > 0) {
      const examTitles = [...new Set(activeExams.map((eq) => eq.exam.title))].join(', ');
      throw new AppError(
        `Cannot delete: some questions are used in active exam(s): ${examTitles}`,
        409,
      );
    }

    const deleteResult = await prisma.question.deleteMany({
      where: { id: { in: ids } },
    });

    await this.invalidateQuestionListCaches();

    return {
      success: true,
      message: `Successfully deleted ${deleteResult.count} question(s)`,
      data: null,
    };
  }

  // ═══════════════════════════════════════════════
  // BULK CREATE (for document-import preview confirmation)
  // ═══════════════════════════════════════════════

  async bulkCreate(
    questions: BulkQuestionPayload[],
    meta: { subjectId: number; chapterId: number; topicId?: number },
    userId: number,
  ) {
    const topicId = await this.resolveImportTopicId(
      meta.subjectId,
      meta.chapterId,
      meta.topicId,
    );

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new AppError('No questions provided', 400);
    }

    const errors: Array<{ index: number; message: string }> = [];
    const valid: BulkQuestionPayload[] = [];

    questions.forEach((q, idx) => {
      const stem = String(q.content || '').trim();
      if (!stem) {
        errors.push({ index: idx, message: 'Question content is empty' });
        return;
      }
      const questionType = this.normalizeQuestionType(q.questionType);
      if (!Array.isArray(q.options) || q.options.length === 0) {
        errors.push({ index: idx, message: 'At least one option/answer is required' });
        return;
      }
      if (q.options.length > 26) {
        errors.push({ index: idx, message: 'A question can have at most 26 options/answers' });
        return;
      }
      const labels = q.options.map((o) => String(o.label).toUpperCase());
      const duplicateLabel = labels.find((label, labelIndex) => labels.indexOf(label) !== labelIndex);
      if (duplicateLabel) {
        errors.push({ index: idx, message: `Duplicate option label ${duplicateLabel}` });
        return;
      }
      if (labels.some((label) => !/^[A-Z]$/.test(label))) {
        errors.push({ index: idx, message: 'Option labels must be A-Z' });
        return;
      }
      if (q.options.some((o) => !String(o.content || '').trim())) {
        errors.push({ index: idx, message: 'All options/answers must have content' });
        return;
      }
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if ((questionType === 'SINGLE_CHOICE' || questionType === 'TRUE_FALSE') && correctCount !== 1) {
        errors.push({
          index: idx,
          message: `${questionType.replace('_', ' ')} requires exactly one correct answer`,
        });
        return;
      }
      if (questionType === 'TRUE_FALSE' && q.options.length !== 2) {
        errors.push({ index: idx, message: 'TRUE_FALSE requires exactly 2 options' });
        return;
      }
      if (questionType === 'SINGLE_CHOICE' && q.options.length < 2) {
        errors.push({ index: idx, message: 'SINGLE_CHOICE requires at least 2 options' });
        return;
      }
      if (questionType === 'MULTIPLE_CHOICE' && correctCount < 1) {
        errors.push({ index: idx, message: 'MULTIPLE_CHOICE requires at least one correct option' });
        return;
      }
      if (questionType === 'SHORT_ANSWER' && correctCount < 1) {
        errors.push({ index: idx, message: 'SHORT_ANSWER requires at least one accepted answer' });
        return;
      }
      if (questionType === 'MATCHING' && q.options.length < 2) {
        errors.push({ index: idx, message: 'MATCHING requires at least two pairs' });
        return;
      }
      const diff = Number(q.difficulty);
      if (!Number.isInteger(diff) || diff < 1 || diff > 5) {
        errors.push({
          index: idx,
          message: 'Difficulty must be an integer between 1 and 5',
        });
        return;
      }
      valid.push({
        content: sanitizeRichQuestionHtml(stem),
        questionType,
        difficulty: diff,
        explanation: q.explanation ? sanitizeRichQuestionHtml(String(q.explanation).trim()) : null,
        options: q.options.map((o) => ({
          label: String(o.label).toUpperCase(),
          content: sanitizeRichQuestionHtml(String(o.content).trim()),
          isCorrect: Boolean(o.isCorrect),
        })),
      });
    });

    if (valid.length === 0) {
      return {
        success: false,
        message: 'No valid questions to import',
        data: { imported: 0, failed: questions.length, errors },
      };
    }

    const created = await prisma.$transaction(
      valid.map((q) =>
        prisma.question.create({
          data: {
            subjectId: meta.subjectId,
            chapterId: meta.chapterId,
            topicId,
            content: q.content,
            questionType: q.questionType,
            difficulty: q.difficulty,
            explanation: q.explanation,
            createdBy: userId,
            options: { create: q.options },
          },
        }),
      ),
    );

    await this.invalidateQuestionListCaches();

    return {
      success: true,
      message: `Imported ${created.length} question(s) successfully`,
      data: {
        imported: created.length,
        failed: questions.length - valid.length,
        total: questions.length,
        errors: errors.length > 0 ? errors : null,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // IMPORT FROM EXCEL
  // ═══════════════════════════════════════════════

  async importFromExcel(
    fileBuffer: Buffer,
    meta: ImportQuestionsInput,
    userId: number,
  ) {
    const topicId = await this.resolveImportTopicId(
      meta.subjectId,
      meta.chapterId,
      meta.topicId,
    );

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new AppError('Excel file has no sheets', 400);
    }

    const rows = XLSX.utils.sheet_to_json<ExcelRow>(workbook.Sheets[sheetName], {
      defval: '',
    });

    if (rows.length === 0) {
      throw new AppError('Excel file is empty', 400);
    }

    const headers = Object.keys(rows[0] || {});
    const missingHeaders = IMPORT_HEADERS.filter(
      (h) => !headers.some((hdr) => hdr.toLowerCase().trim() === h.toLowerCase()),
    );
    if (missingHeaders.length > 0) {
      throw new AppError(
        `Missing required columns: ${missingHeaders.join(', ')}. Expected: ${IMPORT_HEADERS.join(', ')}`,
        400,
      );
    }

    const errors: ImportError[] = [];
    const validQuestions: {
      content: string;
      options: { label: string; content: string; isCorrect: boolean }[];
      explanation: string | null;
      difficulty: number;
    }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row (1-indexed + header)

      const content = String(row.content || '').trim();
      if (!content) {
        errors.push({ row: rowNum, field: 'content', message: 'Question content is empty' });
        continue;
      }

      const optA = String(row.A || '').trim();
      const optB = String(row.B || '').trim();
      const optC = String(row.C || '').trim();
      const optD = String(row.D || '').trim();

      if (!optA) errors.push({ row: rowNum, field: 'A', message: 'Option A is empty' });
      if (!optB) errors.push({ row: rowNum, field: 'B', message: 'Option B is empty' });
      if (!optC) errors.push({ row: rowNum, field: 'C', message: 'Option C is empty' });
      if (!optD) errors.push({ row: rowNum, field: 'D', message: 'Option D is empty' });

      const correctRaw = String(row.correct || '').trim().toUpperCase();
      const validCorrect = correctRaw.split(/[,;]/).map((c) => c.trim()).filter((c) => /^[A-D]$/.test(c));
      if (validCorrect.length === 0) {
        errors.push({
          row: rowNum,
          field: 'correct',
          message: `Invalid correct answer "${row.correct}". Must be A, B, C, or D (or comma-separated)`,
        });
      }

      const difficulty = Number(row.difficulty);
      if (isNaN(difficulty) || difficulty < 1 || difficulty > 5 || !Number.isInteger(difficulty)) {
        errors.push({
          row: rowNum,
          field: 'difficulty',
          message: `Invalid difficulty "${row.difficulty}". Must be an integer 1–5`,
        });
      }

      const hasFieldError = errors.some((e) => e.row === rowNum);
      if (hasFieldError) continue;

      const explanation = row.explanation ? String(row.explanation).trim() : null;

      validQuestions.push({
        content: sanitizeRichQuestionHtml(content),
        options: [
          { label: 'A', content: sanitizeRichQuestionHtml(optA), isCorrect: validCorrect.includes('A') },
          { label: 'B', content: sanitizeRichQuestionHtml(optB), isCorrect: validCorrect.includes('B') },
          { label: 'C', content: sanitizeRichQuestionHtml(optC), isCorrect: validCorrect.includes('C') },
          { label: 'D', content: sanitizeRichQuestionHtml(optD), isCorrect: validCorrect.includes('D') },
        ],
        explanation: explanation ? sanitizeRichQuestionHtml(explanation) : null,
        difficulty,
      });
    }

    if (validQuestions.length === 0) {
      return {
        success: false,
        message: 'No valid questions found in file',
        data: { imported: 0, failed: rows.length, errors },
      };
    }

    const created = await prisma.$transaction(
      validQuestions.map((q) =>
        prisma.question.create({
          data: {
            subjectId: meta.subjectId,
            chapterId: meta.chapterId,
            topicId,
            content: q.content,
            questionType: 'SINGLE_CHOICE',
            difficulty: q.difficulty,
            explanation: q.explanation,
            createdBy: userId,
            options: { create: q.options },
          },
        }),
      ),
    );

    await this.invalidateQuestionListCaches();

    return {
      success: true,
      message: `Imported ${created.length} question(s) successfully`,
      data: {
        imported: created.length,
        failed: rows.length - validQuestions.length,
        total: rows.length,
        errors: errors.length > 0 ? errors : null,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // DOWNLOAD EXCEL TEMPLATE
  // ═══════════════════════════════════════════════

  generateImportTemplate(): Buffer {
    const sampleData = [
      {
        content: 'Which of the following is a quadratic equation?',
        A: 'x + 1 = 0',
        B: 'x² + 2x + 1 = 0',
        C: 'x³ = 8',
        D: '2x = 4',
        correct: 'B',
        explanation: 'A quadratic equation has the form ax² + bx + c = 0 with a ≠ 0',
        difficulty: 2,
      },
      {
        content: 'Which element has atomic number 6?',
        A: 'Nitrogen',
        B: 'Oxygen',
        C: 'Carbon',
        D: 'Boron',
        correct: 'C',
        explanation: 'Carbon (C) has Z = 6',
        difficulty: 1,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: [...IMPORT_HEADERS] });

    const colWidths = [
      { wch: 50 }, // content
      { wch: 25 }, // A
      { wch: 25 }, // B
      { wch: 25 }, // C
      { wch: 25 }, // D
      { wch: 10 }, // correct
      { wch: 50 }, // explanation
      { wch: 10 }, // difficulty
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

    const instructionData = [
      ['Question Import Instructions'],
      [''],
      ['Column', 'Description', 'Required'],
      ['content', 'Question content', 'Yes'],
      ['A', 'Option A', 'Yes'],
      ['B', 'Option B', 'Yes'],
      ['C', 'Option C', 'Yes'],
      ['D', 'Option D', 'Yes'],
      ['correct', 'Correct answer (A/B/C/D, multiple answers separated by commas)', 'Yes'],
      ['explanation', 'Answer explanation', 'No'],
      ['difficulty', 'Difficulty (1-5): 1=Very Easy, 2=Easy, 3=Medium, 4=Hard, 5=Very Hard', 'Yes'],
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructionData);
    instructionSheet['!cols'] = [{ wch: 15 }, { wch: 60 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  // ═══════════════════════════════════════════════
  // ADD TAGS
  // ═══════════════════════════════════════════════

  async generateGiftExport(questionIds: number[]): Promise<string> {
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      throw new AppError('No question IDs provided for export', 400);
    }

    const uniqueIds = [...new Set(questionIds.filter((id) => Number.isInteger(id) && id > 0))];
    if (uniqueIds.length === 0) {
      throw new AppError('No valid question IDs provided for export', 400);
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: uniqueIds } },
      include: { options: { orderBy: { label: 'asc' } } },
      orderBy: { id: 'asc' },
    });

    if (questions.length === 0) {
      throw new AppError('No questions found to export', 404);
    }

    const blocks = await Promise.all(
      questions.map(async (question) => {
        const content = await this.prepareHtmlForGift(question.content);
        const options = await Promise.all(
          question.options.map(async (option) => ({
            ...option,
            content: await this.prepareHtmlForGift(option.content),
          })),
        );
        const title = `Question ${question.id}`;

        if (question.questionType === 'SHORT_ANSWER') {
          const answers = options
            .filter((option) => option.isCorrect)
            .map((option) => `=${escapeGiftText(option.content)}`)
            .join('\n');
          return `::${escapeGiftText(title)}::${escapeGiftText(content)} {\n${answers}\n}`;
        }

        if (question.questionType === 'MATCHING') {
          const pairs = options
            .map((option) => {
              const pair = this.splitMatchingPair(option.content);
              return `=${escapeGiftText(pair.left)} -> ${escapeGiftText(pair.right)}`;
            })
            .join('\n');
          return `::${escapeGiftText(title)}::${escapeGiftText(content)} {\n${pairs}\n}`;
        }

        if (question.questionType === 'MULTIPLE_CHOICE') {
          const correctCount = options.filter((option) => option.isCorrect).length;
          const fraction = correctCount > 0 ? 100 / correctCount : 0;
          const answers = options
            .map((option) => {
              if (option.isCorrect) {
                return `~%${fraction.toFixed(5).replace(/\.?0+$/, '')}%${escapeGiftText(option.content)}`;
              }
              return `~${escapeGiftText(option.content)}`;
            })
            .join('\n');
          return `::${escapeGiftText(title)}::${escapeGiftText(content)} {\n${answers}\n}`;
        }

        const answers = options
          .map((option) => `${option.isCorrect ? '=' : '~'}${escapeGiftText(option.content)}`)
          .join('\n');
        return `::${escapeGiftText(title)}::${escapeGiftText(content)} {\n${answers}\n}`;
      }),
    );

    return `${blocks.join('\n\n')}\n`;
  }

  async addTags(questionId: number, data: AddTagsInput) {
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new AppError('Question not found', 404);
    }

    const existingTags = await prisma.questionTag.findMany({
      where: { questionId },
      select: { tagName: true },
    });
    const existingNames = new Set(existingTags.map((t) => t.tagName.toLowerCase()));

    const newTags = data.tags.filter((t) => !existingNames.has(t.toLowerCase()));

    if (newTags.length > 0) {
      await prisma.questionTag.createMany({
        data: newTags.map((tagName) => ({ questionId, tagName })),
      });
    }

    const allTags = await prisma.questionTag.findMany({
      where: { questionId },
      select: { id: true, tagName: true },
    });

    await this.invalidateQuestionListCaches();

    return {
      success: true,
      message: `Added ${newTags.length} new tag(s), ${data.tags.length - newTags.length} already existed`,
      data: allTags,
    };
  }

  // ═══════════════════════════════════════════════
  // REMOVE TAG
  // ═══════════════════════════════════════════════

  async removeTag(questionId: number, tagId: number) {
    const tag = await prisma.questionTag.findFirst({
      where: { id: tagId, questionId },
    });

    if (!tag) {
      throw new AppError('Tag not found on this question', 404);
    }

    await prisma.questionTag.delete({ where: { id: tagId } });

    await this.invalidateQuestionListCaches();

    return {
      success: true,
      message: 'Tag removed successfully',
      data: null,
    };
  }

  // ═══════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════

  private normalizeQuestionType(value: unknown): SupportedQuestionKind {
    const questionType = String(value || 'SINGLE_CHOICE').toUpperCase();
    if (
      questionType === 'SINGLE_CHOICE' ||
      questionType === 'MULTIPLE_CHOICE' ||
      questionType === 'TRUE_FALSE' ||
      questionType === 'SHORT_ANSWER' ||
      questionType === 'MATCHING'
    ) {
      return questionType;
    }
    return 'SINGLE_CHOICE';
  }

  private splitMatchingPair(content: string): { left: string; right: string } {
    const [left = '', ...rightParts] = content.split(/\s*(?:=>|->)\s*/);
    return {
      left: left.trim() || content,
      right: rightParts.join(' -> ').trim() || content,
    };
  }

  private async prepareHtmlForGift(html: string): Promise<string> {
    let result = sanitizeRichQuestionHtml(html);
    const sources = extractImageSources(result);
    for (const src of sources) {
      const dataUri = await this.imageSrcToDataUri(src);
      result = result.replace(src, dataUri);
    }
    return result;
  }

  private async imageSrcToDataUri(src: string): Promise<string> {
    if (src.startsWith('data:image/')) return src;

    const objectName = objectNameFromQuestionImageSrc(src);
    if (objectName) {
      return readQuestionImageAsDataUri(objectName);
    }

    const response = await fetch(src);
    if (!response.ok) {
      throw new AppError(`Unable to download image for GIFT export: ${src}`, 400);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new AppError(`Image URL did not return an image: ${src}`, 400);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > FILE_UPLOAD.MAX_QUESTION_IMAGE_SIZE) {
      throw new AppError('Question image is too large to export to GIFT', 400);
    }
    return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
  }

  private async resolveImportTopicId(
    subjectId: number,
    chapterId: number,
    topicId?: number,
  ): Promise<number> {
    const [subject, chapter] = await Promise.all([
      prisma.subject.findUnique({ where: { id: subjectId } }),
      prisma.chapter.findUnique({ where: { id: chapterId } }),
    ]);

    if (!subject) throw new AppError('Subject not found', 404);
    if (!isCoreSubjectCode(subject.code)) throw new AppError('Subject not found', 404);
    if (!chapter) throw new AppError('Chapter not found', 404);

    if (chapter.subjectId !== subjectId) {
      throw new AppError('Chapter does not belong to the specified subject', 400);
    }

    if (topicId) {
      const topic = await prisma.topic.findUnique({ where: { id: topicId } });
      if (!topic) throw new AppError('Topic not found', 404);
      if (topic.chapterId !== chapterId) {
        throw new AppError('Topic does not belong to the specified chapter', 400);
      }
      return topic.id;
    }

    const existingDefaultTopic = await prisma.topic.findFirst({
      where: { chapterId, name: 'General' },
      orderBy: { id: 'asc' },
    });
    if (existingDefaultTopic) return existingDefaultTopic.id;

    const createdDefaultTopic = await prisma.topic.create({
      data: { chapterId, name: 'General' },
    });
    return createdDefaultTopic.id;
  }

  private async validateCurriculumRefs(
    subjectId: number,
    chapterId: number,
    topicId: number,
  ) {
    const [subject, chapter, topic] = await Promise.all([
      prisma.subject.findUnique({ where: { id: subjectId } }),
      prisma.chapter.findUnique({ where: { id: chapterId } }),
      prisma.topic.findUnique({ where: { id: topicId } }),
    ]);

    if (!subject) throw new AppError('Subject not found', 404);
    if (!isCoreSubjectCode(subject.code)) throw new AppError('Subject not found', 404);
    if (!chapter) throw new AppError('Chapter not found', 404);
    if (!topic) throw new AppError('Topic not found', 404);

    if (chapter.subjectId !== subjectId) {
      throw new AppError('Chapter does not belong to the specified subject', 400);
    }
    if (topic.chapterId !== chapterId) {
      throw new AppError('Topic does not belong to the specified chapter', 400);
    }
  }
}

export const questionService = new QuestionService();
