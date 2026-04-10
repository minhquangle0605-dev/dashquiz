import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { isCoreSubjectCode } from '../../constants/subjects';
import { PAGINATION } from '../../utils/constants';
import { cacheGet, cacheSet, cacheInvalidate } from '../../utils/cache';
import { buildPaginationResponse } from '../../utils/pagination';
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

const LIST_QUESTIONS_CACHE_TTL = 180; // 3 minutes

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
      c: query.chapterId ?? null,
      t: query.topicId ?? null,
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
    if (query.chapterId) where.chapterId = query.chapterId;
    if (query.topicId) where.topicId = query.topicId;

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
          chapter: { select: { id: true, name: true } },
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
        chapter: { select: { id: true, name: true } },
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
    await this.validateCurriculumRefs(data.subjectId, data.chapterId, data.topicId);

    const question = await prisma.question.create({
      data: {
        subjectId: data.subjectId,
        chapterId: data.chapterId,
        topicId: data.topicId,
        content: data.content,
        questionType: data.questionType,
        difficulty: data.difficulty,
        explanation: data.explanation ?? null,
        createdBy: userId,
        options: {
          create: data.options.map((opt) => ({
            label: opt.label,
            content: opt.content,
            isCorrect: opt.isCorrect,
          })),
        },
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        chapter: { select: { id: true, name: true } },
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
    const topicId = data.topicId ?? existing.topicId;

    if (data.subjectId || data.chapterId || data.topicId) {
      await this.validateCurriculumRefs(subjectId, chapterId, topicId);
    }

    const question = await prisma.$transaction(async (tx) => {
      if (data.options) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        await tx.questionOption.createMany({
          data: data.options.map((opt) => ({
            questionId: id,
            label: opt.label,
            content: opt.content,
            isCorrect: opt.isCorrect,
          })),
        });
      }

      return tx.question.update({
        where: { id },
        data: {
          ...(data.content !== undefined && { content: data.content }),
          ...(data.questionType !== undefined && { questionType: data.questionType }),
          ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
          ...(data.explanation !== undefined && { explanation: data.explanation }),
          ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
          ...(data.chapterId !== undefined && { chapterId: data.chapterId }),
          ...(data.topicId !== undefined && { topicId: data.topicId }),
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          chapter: { select: { id: true, name: true } },
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
  // IMPORT FROM EXCEL
  // ═══════════════════════════════════════════════

  async importFromExcel(
    fileBuffer: Buffer,
    meta: ImportQuestionsInput,
    userId: number,
  ) {
    await this.validateCurriculumRefs(meta.subjectId, meta.chapterId, meta.topicId);

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
        content,
        options: [
          { label: 'A', content: optA, isCorrect: validCorrect.includes('A') },
          { label: 'B', content: optB, isCorrect: validCorrect.includes('B') },
          { label: 'C', content: optC, isCorrect: validCorrect.includes('C') },
          { label: 'D', content: optD, isCorrect: validCorrect.includes('D') },
        ],
        explanation,
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
            topicId: meta.topicId,
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
        content: 'Phương trình nào sau đây là phương trình bậc hai?',
        A: 'x + 1 = 0',
        B: 'x² + 2x + 1 = 0',
        C: 'x³ = 8',
        D: '2x = 4',
        correct: 'B',
        explanation: 'Phương trình bậc hai có dạng ax² + bx + c = 0 với a ≠ 0',
        difficulty: 2,
      },
      {
        content: 'Nguyên tố nào có số hiệu nguyên tử là 6?',
        A: 'Nitơ',
        B: 'Oxi',
        C: 'Cacbon',
        D: 'Bo',
        correct: 'C',
        explanation: 'Cacbon (C) có Z = 6',
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
      ['Hướng dẫn Import Câu hỏi'],
      [''],
      ['Cột', 'Mô tả', 'Bắt buộc'],
      ['content', 'Nội dung câu hỏi', 'Có'],
      ['A', 'Đáp án A', 'Có'],
      ['B', 'Đáp án B', 'Có'],
      ['C', 'Đáp án C', 'Có'],
      ['D', 'Đáp án D', 'Có'],
      ['correct', 'Đáp án đúng (A/B/C/D, nhiều đáp án phân cách bằng dấu phẩy)', 'Có'],
      ['explanation', 'Giải thích đáp án', 'Không'],
      ['difficulty', 'Độ khó (1-5): 1=Rất dễ, 2=Dễ, 3=Trung bình, 4=Khó, 5=Rất khó', 'Có'],
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructionData);
    instructionSheet['!cols'] = [{ wch: 15 }, { wch: 60 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Huong dan');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  // ═══════════════════════════════════════════════
  // ADD TAGS
  // ═══════════════════════════════════════════════

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
