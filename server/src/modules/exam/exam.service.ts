import { Prisma, ExamStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { PAGINATION } from '../../utils/constants';
import { cacheGet, cacheSet, cacheInvalidateExact } from '../../utils/cache';
import { buildPaginationResponse } from '../../utils/pagination';
import { notificationService } from '../notification/notification.service';
import { emitExamStarted, emitExamClosed, emitDashboardUpdateBulk } from '../../socket';
import type {
  CreateExamInput,
  UpdateExamInput,
  AddQuestionsInput,
  ScheduleExamInput,
  AssignExamInput,
  ListExamsQuery,
} from './exam.validation';

const EXAM_DETAIL_CACHE_TTL = 300;

export class ExamService {
  private examDetailCacheKey(id: number): string {
    return `exam:detail:${id}`;
  }

  private async invalidateExamDetail(id: number): Promise<void> {
    await cacheInvalidateExact(this.examDetailCacheKey(id));
  }

  // ═══════════════════════════════════════════════
  // LIST EXAMS
  // ═══════════════════════════════════════════════

  async listExams(query: ListExamsQuery, userId: number, role: string) {
    const page = query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Prisma.ExamWhereInput = {};

    if (role === 'teacher') {
      where.createdBy = userId;
    }

    if (query.status) {
      where.status = query.status as ExamStatus;
    }

    if (query.subjectId) {
      where.subjectId = query.subjectId;
    }

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        select: {
          id: true,
          title: true,
          subjectId: true,
          createdBy: true,
          durationMin: true,
          totalQuestions: true,
          passingScore: true,
          shuffle: true,
          showResult: true,
          maxAttempts: true,
          status: true,
          createdAt: true,
          subject: { select: { id: true, name: true, code: true } },
          creator: { select: { id: true, fullName: true } },
          _count: {
            select: {
              examQuestions: true,
              examAssignments: true,
              examAttempts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.exam.count({ where }),
    ]);

    return {
      success: true,
      message: 'Exams retrieved successfully',
      data: exams,
      pagination: buildPaginationResponse(total, page, limit),
    };
  }

  // ═══════════════════════════════════════════════
  // GET EXAM BY ID (detail + questions)
  // ═══════════════════════════════════════════════

  async getExamById(id: number) {
    const cacheKey = this.examDetailCacheKey(id);
    const cached = await cacheGet<{
      success: true;
      message: string;
      data: Record<string, unknown>;
    }>(cacheKey);
    if (cached) {
      return cached as never;
    }

    const exam = await prisma.exam.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        subjectId: true,
        createdBy: true,
        durationMin: true,
        totalQuestions: true,
        passingScore: true,
        shuffle: true,
        showResult: true,
        maxAttempts: true,
        status: true,
        createdAt: true,
        subject: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, fullName: true } },
        examQuestions: {
          orderBy: { orderIndex: 'asc' },
          select: {
            examId: true,
            questionId: true,
            orderIndex: true,
            points: true,
            question: {
              select: {
                id: true,
                subjectId: true,
                chapterId: true,
                topicId: true,
                content: true,
                questionType: true,
                difficulty: true,
                explanation: true,
                createdBy: true,
                createdAt: true,
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
                chapter: { select: { id: true, name: true } },
                topic: { select: { id: true, name: true } },
              },
            },
          },
        },
        examSchedules: {
          orderBy: { startTime: 'desc' },
          take: 5,
          select: {
            id: true,
            examId: true,
            startTime: true,
            endTime: true,
            status: true,
          },
        },
        examAssignments: {
          select: {
            id: true,
            examId: true,
            classId: true,
            assignedBy: true,
            assignedAt: true,
            class: { select: { id: true, name: true, gradeLevel: true } },
            assignedTo: { select: { id: true, fullName: true } },
          },
        },
        _count: { select: { examAttempts: true } },
      },
    });

    if (!exam) {
      throw new AppError('Exam not found', 404);
    }

    const result = {
      success: true as const,
      message: 'Exam retrieved successfully',
      data: exam,
    };
    await cacheSet(cacheKey, result, EXAM_DETAIL_CACHE_TTL);
    return result;
  }

  // ═══════════════════════════════════════════════
  // CREATE EXAM
  // ═══════════════════════════════════════════════

  async createExam(data: CreateExamInput, userId: number) {
    const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
    if (!subject) throw new AppError('Subject not found', 404);

    const exam = await prisma.exam.create({
      data: {
        title: data.title,
        subjectId: data.subjectId,
        createdBy: userId,
        durationMin: data.durationMin,
        totalQuestions: data.totalQuestions,
        passingScore: data.passingScore ?? null,
        shuffle: data.shuffle,
        showResult: data.showResult,
        maxAttempts: data.maxAttempts,
        status: 'DRAFT',
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, fullName: true } },
      },
    });

    await this.invalidateExamDetail(exam.id);

    return {
      success: true,
      message: 'Exam created successfully',
      data: exam,
    };
  }

  // ═══════════════════════════════════════════════
  // UPDATE EXAM (only DRAFT)
  // ═══════════════════════════════════════════════

  async updateExam(id: number, data: UpdateExamInput, userId: number) {
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new AppError('Exam not found', 404);

    if (exam.createdBy !== userId) {
      throw new AppError('You can only edit your own exams', 403);
    }

    if (exam.status !== 'DRAFT') {
      throw new AppError('Only DRAFT exams can be edited', 400);
    }

    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject) throw new AppError('Subject not found', 404);
    }

    const updated = await prisma.exam.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
        ...(data.durationMin !== undefined && { durationMin: data.durationMin }),
        ...(data.totalQuestions !== undefined && { totalQuestions: data.totalQuestions }),
        ...(data.passingScore !== undefined && { passingScore: data.passingScore }),
        ...(data.shuffle !== undefined && { shuffle: data.shuffle }),
        ...(data.showResult !== undefined && { showResult: data.showResult }),
        ...(data.maxAttempts !== undefined && { maxAttempts: data.maxAttempts }),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, fullName: true } },
      },
    });

    await this.invalidateExamDetail(id);

    return {
      success: true,
      message: 'Exam updated successfully',
      data: updated,
    };
  }

  // ═══════════════════════════════════════════════
  // ADD QUESTIONS (manual pick or random)
  // ═══════════════════════════════════════════════

  async addQuestions(examId: number, data: AddQuestionsInput, userId: number) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new AppError('Exam not found', 404);
    if (exam.createdBy !== userId) throw new AppError('You can only edit your own exams', 403);
    if (exam.status !== 'DRAFT') throw new AppError('Only DRAFT exams can be modified', 400);

    let questionIds: number[] = [];

    if (data.mode === 'manual') {
      questionIds = data.questionIds!;

      const existingQuestions = await prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: { id: true },
      });
      const foundIds = new Set(existingQuestions.map((q) => q.id));
      const missing = questionIds.filter((qid) => !foundIds.has(qid));
      if (missing.length > 0) {
        throw new AppError(`Questions not found: ${missing.join(', ')}`, 404);
      }
    } else {
      const cfg = data.randomConfig!;

      const where: Prisma.QuestionWhereInput = { subjectId: cfg.subjectId };
      if (cfg.chapterIds && cfg.chapterIds.length > 0) {
        where.chapterId = { in: cfg.chapterIds };
      }
      if (cfg.difficulty) {
        where.difficulty = cfg.difficulty;
      }

      const alreadyInExam = await prisma.examQuestion.findMany({
        where: { examId },
        select: { questionId: true },
      });
      const excludeIds = alreadyInExam.map((eq) => eq.questionId);
      if (excludeIds.length > 0) {
        where.id = { notIn: excludeIds };
      }

      const available = await prisma.question.findMany({
        where,
        select: { id: true },
      });

      if (available.length < cfg.count) {
        throw new AppError(
          `Not enough questions available. Requested ${cfg.count}, found ${available.length}`,
          400,
        );
      }

      const shuffled = available.sort(() => Math.random() - 0.5);
      questionIds = shuffled.slice(0, cfg.count).map((q) => q.id);
    }

    const existingEQ = await prisma.examQuestion.findMany({
      where: { examId },
      select: { questionId: true },
      orderBy: { orderIndex: 'desc' },
    });
    const alreadyAdded = new Set(existingEQ.map((eq) => eq.questionId));
    const newIds = questionIds.filter((qid) => !alreadyAdded.has(qid));

    if (newIds.length === 0) {
      return {
        success: true,
        message: 'All questions already in the exam',
        data: { added: 0, skipped: questionIds.length },
      };
    }

    let startIndex = existingEQ.length > 0
      ? (await prisma.examQuestion.aggregate({ where: { examId }, _max: { orderIndex: true } }))._max.orderIndex! + 1
      : 1;

    const pointsPerQuestion = exam.totalQuestions > 0
      ? parseFloat((10 / exam.totalQuestions).toFixed(2))
      : 1;

    await prisma.examQuestion.createMany({
      data: newIds.map((questionId, i) => ({
        examId,
        questionId,
        orderIndex: startIndex + i,
        points: new Prisma.Decimal(pointsPerQuestion),
      })),
    });

    const totalInExam = await prisma.examQuestion.count({ where: { examId } });
    await prisma.exam.update({
      where: { id: examId },
      data: { totalQuestions: totalInExam },
    });

    await this.invalidateExamDetail(examId);

    return {
      success: true,
      message: `Added ${newIds.length} question(s) to exam`,
      data: {
        added: newIds.length,
        skipped: questionIds.length - newIds.length,
        totalInExam,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // PUBLISH EXAM (DRAFT → PUBLISHED)
  // ═══════════════════════════════════════════════

  async publishExam(examId: number, userId: number) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { _count: { select: { examQuestions: true } } },
    });

    if (!exam) throw new AppError('Exam not found', 404);
    if (exam.createdBy !== userId) throw new AppError('You can only publish your own exams', 403);
    if (exam.status !== 'DRAFT') throw new AppError('Only DRAFT exams can be published', 400);
    if (exam._count.examQuestions === 0) throw new AppError('Exam must have at least one question', 400);

    const updated = await prisma.exam.update({
      where: { id: examId },
      data: { status: 'PUBLISHED' },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, fullName: true } },
      },
    });

    // Emit exam:started to all assigned classes via Socket.IO
    const assignments = await prisma.examAssignment.findMany({
      where: { examId },
      select: { classId: true },
    });
    if (assignments.length > 0) {
      const classIds = assignments.map((a) => a.classId);
      emitExamStarted(classIds, {
        examId,
        title: updated.title,
        subjectName: updated.subject.name,
        durationMin: updated.durationMin,
      });
    }

    notificationService
      .onResultsPublished(examId, updated.title)
      .catch((err) => logger.warn('Notification trigger onResultsPublished failed:', err));

    await this.invalidateExamDetail(examId);

    return {
      success: true,
      message: 'Exam published successfully',
      data: updated,
    };
  }

  // ═══════════════════════════════════════════════
  // SCHEDULE EXAM
  // ═══════════════════════════════════════════════

  async scheduleExam(examId: number, data: ScheduleExamInput, userId: number) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new AppError('Exam not found', 404);
    if (exam.createdBy !== userId) throw new AppError('You can only schedule your own exams', 403);

    if (exam.status !== 'DRAFT' && exam.status !== 'PUBLISHED') {
      throw new AppError('Only DRAFT or PUBLISHED exams can be scheduled', 400);
    }

    const schedule = await prisma.examSchedule.create({
      data: {
        examId,
        startTime: data.startTime,
        endTime: data.endTime,
        status: 'PENDING',
      },
    });

    if (exam.status === 'DRAFT') {
      await prisma.exam.update({
        where: { id: examId },
        data: { status: 'SCHEDULED' },
      });
    }

    await this.invalidateExamDetail(examId);

    return {
      success: true,
      message: 'Exam scheduled successfully',
      data: schedule,
    };
  }

  // ═══════════════════════════════════════════════
  // ASSIGN EXAM TO CLASS(ES)
  // ═══════════════════════════════════════════════

  async assignExam(examId: number, data: AssignExamInput, userId: number) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new AppError('Exam not found', 404);

    if (exam.status === 'DRAFT') {
      throw new AppError('Cannot assign a DRAFT exam. Publish or schedule it first.', 400);
    }

    const classes = await prisma.class.findMany({
      where: { id: { in: data.classIds } },
      select: { id: true, name: true },
    });

    if (classes.length !== data.classIds.length) {
      const foundIds = new Set(classes.map((c) => c.id));
      const missing = data.classIds.filter((cid) => !foundIds.has(cid));
      throw new AppError(`Classes not found: ${missing.join(', ')}`, 404);
    }

    const existing = await prisma.examAssignment.findMany({
      where: { examId, classId: { in: data.classIds } },
      select: { classId: true },
    });
    const alreadyAssigned = new Set(existing.map((ea) => ea.classId));
    const newClassIds = data.classIds.filter((cid) => !alreadyAssigned.has(cid));

    if (newClassIds.length === 0) {
      return {
        success: true,
        message: 'All classes already assigned',
        data: { assigned: 0, skipped: data.classIds.length },
      };
    }

    await prisma.examAssignment.createMany({
      data: newClassIds.map((classId) => ({
        examId,
        classId,
        assignedBy: userId,
      })),
    });

    // Broadcast exam:started to newly assigned classes if exam is published
    if (exam.status === 'PUBLISHED' || exam.status === 'SCHEDULED') {
      const examWithSubject = await prisma.exam.findUnique({
        where: { id: examId },
        include: { subject: { select: { name: true } } },
      });
      if (examWithSubject) {
        emitExamStarted(newClassIds, {
          examId,
          title: examWithSubject.title,
          subjectName: examWithSubject.subject.name,
          durationMin: examWithSubject.durationMin,
        });
      }
    }

    notificationService
      .onExamAssigned(examId, newClassIds)
      .catch((err) => logger.warn('Notification trigger onExamAssigned failed:', err));

    await this.invalidateExamDetail(examId);

    return {
      success: true,
      message: `Exam assigned to ${newClassIds.length} class(es)`,
      data: {
        assigned: newClassIds.length,
        skipped: data.classIds.length - newClassIds.length,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // LIST ASSIGNMENTS FOR AN EXAM
  // ═══════════════════════════════════════════════

  async getAssignments(examId: number) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new AppError('Exam not found', 404);

    const assignments = await prisma.examAssignment.findMany({
      where: { examId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            _count: { select: { classStudents: true } },
          },
        },
        assignedTo: { select: { id: true, fullName: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return {
      success: true,
      message: 'Assignments retrieved successfully',
      data: assignments,
    };
  }

  // ═══════════════════════════════════════════════
  // CRON: Check exam schedules
  // ═══════════════════════════════════════════════

  async processSchedules() {
    const now = new Date();

    const toActivate = await prisma.examSchedule.findMany({
      where: { status: 'PENDING', startTime: { lte: now } },
      include: {
        exam: {
          include: {
            subject: { select: { name: true } },
            examAssignments: { select: { classId: true } },
          },
        },
      },
    });

    for (const schedule of toActivate) {
      await prisma.$transaction([
        prisma.examSchedule.update({
          where: { id: schedule.id },
          data: { status: 'ACTIVE' },
        }),
        prisma.exam.update({
          where: { id: schedule.examId },
          data: { status: 'PUBLISHED' },
        }),
      ]);

      const classIds = schedule.exam.examAssignments.map((a) => a.classId);
      if (classIds.length > 0) {
        emitExamStarted(classIds, {
          examId: schedule.examId,
          title: schedule.exam.title,
          subjectName: schedule.exam.subject.name,
          durationMin: schedule.exam.durationMin,
        });
      }
    }

    const toClose = await prisma.examSchedule.findMany({
      where: { status: 'ACTIVE', endTime: { lte: now } },
      include: { exam: true },
    });

    for (const schedule of toClose) {
      await prisma.$transaction([
        prisma.examSchedule.update({
          where: { id: schedule.id },
          data: { status: 'COMPLETED' },
        }),
        prisma.exam.update({
          where: { id: schedule.examId },
          data: { status: 'CLOSED' },
        }),
      ]);

      emitExamClosed(schedule.examId, {
        examId: schedule.examId,
        title: schedule.exam.title,
      });
    }

    const affectedExamIds = new Set<number>();
    for (const s of toActivate) affectedExamIds.add(s.examId);
    for (const s of toClose) affectedExamIds.add(s.examId);
    await Promise.all([...affectedExamIds].map((eid) => this.invalidateExamDetail(eid)));

    return { activated: toActivate.length, closed: toClose.length };
  }
}

export const examService = new ExamService();
