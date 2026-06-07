import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { CORE_SUBJECT_CODES, isCoreSubjectCode } from '../../constants/subjects';
import type { CreateChapterInput } from './curriculum.validation';

export class CurriculumService {
  // ═══════════════════════════════════════════════
  // SUBJECTS — public list (UC40 read-only view for teacher/student)
  // ═══════════════════════════════════════════════

  async listSubjects() {
    const subjects = await prisma.subject.findMany({
      where: { status: 1, code: { in: [...CORE_SUBJECT_CODES] } },
      include: {
        _count: { select: { chapters: true, questions: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      message: 'Subjects retrieved successfully',
      data: subjects,
    };
  }

  // ═══════════════════════════════════════════════
  // CHAPTERS BY SUBJECT
  // ═══════════════════════════════════════════════

  async getChaptersBySubject(subjectId: number) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject || !isCoreSubjectCode(subject.code)) {
      throw new AppError('Subject not found', 404);
    }

    const chapters = await prisma.chapter.findMany({
      where: { subjectId },
      include: {
        _count: { select: { questions: true } },
      },
      orderBy: [{ gradeLevel: 'asc' }, { orderIndex: 'asc' }, { name: 'asc' }],
    });

    return {
      success: true,
      message: 'Chapters retrieved successfully',
      data: {
        subject: { id: subject.id, name: subject.name, code: subject.code },
        chapters,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // CREATE CHAPTER (teacher)
  // ═══════════════════════════════════════════════

  async createChapter(data: CreateChapterInput) {
    const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
    if (!subject || !isCoreSubjectCode(subject.code)) {
      throw new AppError('Subject not found', 404);
    }

    const existing = await prisma.chapter.findFirst({
      where: { subjectId: data.subjectId, gradeLevel: data.gradeLevel, name: data.name },
    });
    if (existing) {
      throw new AppError(`Chapter "${data.name}" already exists in this subject`, 409);
    }

    const chapter = await prisma.chapter.create({
      data: {
        subjectId: data.subjectId,
        gradeLevel: data.gradeLevel,
        name: data.name,
        orderIndex: data.orderIndex,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true } },
      },
    });

    return {
      success: true,
      message: 'Chapter created successfully',
      data: chapter,
    };
  }

}

export const curriculumService = new CurriculumService();
