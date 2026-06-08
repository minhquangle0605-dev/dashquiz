import { Prisma, ExamStatus, ExamAttemptEventType } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { isCoreSubjectCode } from '../../constants/subjects';
import { logger } from '../../utils/logger';
import { PAGINATION } from '../../utils/constants';
import { cacheGet, cacheSet, cacheInvalidateExact } from '../../utils/cache';
import { buildPaginationResponse } from '../../utils/pagination';
import { notificationService } from '../notification/notification.service';
import { timetableService } from '../timetable/timetable.service';
import { emitExamStarted, emitExamClosed, emitDashboardUpdateBulk } from '../../socket';
import type {
  CreateExamInput,
  UpdateExamInput,
  AddQuestionsInput,
  ScheduleExamInput,
  AssignExamInput,
  ExamMonitoringQuery,
  ListExamsQuery,
} from './exam.validation';

const EXAM_DETAIL_CACHE_TTL = 300;

const MONITORING_VIOLATION_TYPES = new Set<ExamAttemptEventType>([
  ExamAttemptEventType.TAB_HIDDEN,
  ExamAttemptEventType.WINDOW_BLUR,
  ExamAttemptEventType.COPY,
  ExamAttemptEventType.PASTE,
  ExamAttemptEventType.CUT,
  ExamAttemptEventType.CONTEXT_MENU,
  ExamAttemptEventType.SHORTCUT_BLOCKED,
  ExamAttemptEventType.FULLSCREEN_EXITED,
  ExamAttemptEventType.OFFLINE,
  ExamAttemptEventType.CAMERA_PERMISSION_MISSING,
  ExamAttemptEventType.DEVICE_CHANGED,
]);

const MONITORING_EVENT_WEIGHTS: Partial<Record<ExamAttemptEventType, number>> = {
  [ExamAttemptEventType.TAB_HIDDEN]: 8,
  [ExamAttemptEventType.WINDOW_BLUR]: 8,
  [ExamAttemptEventType.FULLSCREEN_EXITED]: 10,
  [ExamAttemptEventType.COPY]: 8,
  [ExamAttemptEventType.PASTE]: 8,
  [ExamAttemptEventType.CUT]: 8,
  [ExamAttemptEventType.CONTEXT_MENU]: 4,
  [ExamAttemptEventType.SHORTCUT_BLOCKED]: 6,
  [ExamAttemptEventType.OFFLINE]: 4,
  [ExamAttemptEventType.CAMERA_PERMISSION_MISSING]: 20,
  [ExamAttemptEventType.DEVICE_CHANGED]: 20,
  [ExamAttemptEventType.AUTO_SUBMITTED]: 100,
};

type MonitoringEvent = {
  id: number;
  type: ExamAttemptEventType;
  occurredAt: Date;
  clientElapsedSec: number | null;
  questionId: number | null;
  metadata: Prisma.JsonValue | null;
};

function metadataNumber(metadata: Prisma.JsonValue | null, key: string): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function countEvents(events: MonitoringEvent[], type: ExamAttemptEventType): number {
  return events.filter((event) => event.type === type).length;
}

function monitoringRiskLevel(score: number): 'low' | 'watch' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  if (score >= 15) return 'watch';
  return 'low';
}

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

    // Knowledge-graph practice sets are auto-generated and self-/class-launched;
    // keep them out of the standard exam-management lists.
    where.isPractice = false;

    if (role === 'teacher') {
      where.createdBy = userId;
    }

    if (query.status) {
      where.status = query.status as ExamStatus;
    }

    if (query.subjectId) {
      where.subjectId = query.subjectId;
    }

    if (query.classId) {
      where.examAssignments = { some: { classId: query.classId } };
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
          gradingMethod: true,
          shuffleAnswers: true,
          navigationMode: true,
          questionsPerPage: true,
          accessPassword: true,
          reviewOptions: true,
          status: true,
          createdAt: true,
          subject: { select: { id: true, name: true, code: true } },
          creator: { select: { id: true, fullName: true } },
          examAssignments: {
            select: {
              id: true,
              classId: true,
              class: { select: { id: true, name: true, gradeLevel: true } },
            },
          },
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

  async getExamById(id: number, userId: number, role: string) {
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
        gradingMethod: true,
        shuffleAnswers: true,
        navigationMode: true,
        questionsPerPage: true,
        accessPassword: true,
        reviewOptions: true,
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
              },
            },
          },
        },
        examSchedules: {
          orderBy: { startTime: 'desc' },
          take: 20,
          select: {
            id: true,
            examId: true,
            classId: true,
            startTime: true,
            endTime: true,
            room: true,
            proctorId: true,
            status: true,
            class: { select: { id: true, name: true } },
            proctor: { select: { id: true, fullName: true } },
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

    const isOwnerOrAdmin = role === 'admin' || exam.createdBy === userId;
    if (!isOwnerOrAdmin) {
      throw new AppError('You do not have permission to view this exam detail', 403);
    }

    const safeExam = {
      ...exam,
      examQuestions: exam.examQuestions.map((eq) => ({
        ...eq,
        question: {
          ...eq.question,
          options: eq.question.options.map((o) => ({
            id: o.id,
            questionId: o.questionId,
            label: o.label,
            content: o.content,
            isCorrect: o.isCorrect,
          })),
        },
      })),
    };

    return {
      success: true as const,
      message: 'Exam retrieved successfully',
      data: safeExam,
    };
  }

  // ═══════════════════════════════════════════════
  // CREATE EXAM
  // ═══════════════════════════════════════════════

  async createExam(data: CreateExamInput, userId: number) {
    const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
    if (!subject || !isCoreSubjectCode(subject.code)) throw new AppError('Subject not found', 404);

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
        gradingMethod: data.gradingMethod,
        shuffleAnswers: data.shuffleAnswers,
        navigationMode: data.navigationMode,
        questionsPerPage: data.questionsPerPage ?? null,
        accessPassword: data.accessPassword ?? null,
        reviewOptions: data.reviewOptions ?? Prisma.JsonNull,
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

  async updateExam(id: number, data: UpdateExamInput, userId: number, role: string = 'teacher') {
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new AppError('Exam not found', 404);

    if (exam.createdBy !== userId && role !== 'admin') {
      throw new AppError('You can only edit your own exams', 403);
    }

    if (exam.status !== 'DRAFT') {
      throw new AppError('Only DRAFT exams can be edited', 400);
    }

    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject || !isCoreSubjectCode(subject.code)) throw new AppError('Subject not found', 404);
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
        ...(data.gradingMethod !== undefined && { gradingMethod: data.gradingMethod }),
        ...(data.shuffleAnswers !== undefined && { shuffleAnswers: data.shuffleAnswers }),
        ...(data.navigationMode !== undefined && { navigationMode: data.navigationMode }),
        ...(data.questionsPerPage !== undefined && { questionsPerPage: data.questionsPerPage }),
        ...(data.accessPassword !== undefined && { accessPassword: data.accessPassword }),
        ...(data.reviewOptions !== undefined && {
          reviewOptions: data.reviewOptions ?? Prisma.JsonNull,
        }),
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

  async addQuestions(examId: number, data: AddQuestionsInput, userId: number, role: string = 'teacher') {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new AppError('Exam not found', 404);
    if (exam.createdBy !== userId && role !== 'admin') throw new AppError('You can only edit your own exams', 403);
    if (exam.status !== 'DRAFT') throw new AppError('Only DRAFT exams can be modified', 400);

    let questionIds: number[] = [];

    if (data.mode === 'manual') {
      questionIds = [...new Set(data.questionIds!)];

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

      const pool = [...available];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      questionIds = pool.slice(0, cfg.count).map((q) => q.id);
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

    await prisma.examQuestion.createMany({
      data: newIds.map((questionId, i) => ({
        examId,
        questionId,
        orderIndex: startIndex + i,
        points: new Prisma.Decimal(1),
      })),
    });

    const totalInExam = await prisma.examQuestion.count({ where: { examId } });

    const pointsPerQuestion = totalInExam > 0
      ? parseFloat((10 / totalInExam).toFixed(2))
      : 1;

    await prisma.$transaction([
      prisma.exam.update({
        where: { id: examId },
        data: { totalQuestions: totalInExam },
      }),
      prisma.examQuestion.updateMany({
        where: { examId },
        data: { points: new Prisma.Decimal(pointsPerQuestion) },
      }),
    ]);

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

  async publishExam(examId: number, userId: number, role: string = 'teacher') {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { _count: { select: { examQuestions: true } } },
    });

    if (!exam) throw new AppError('Exam not found', 404);
    if (exam.createdBy !== userId && role !== 'admin') {
      throw new AppError('You can only publish your own exams', 403);
    }
    if (exam.status !== 'DRAFT') throw new AppError('Only DRAFT exams can be published', 400);
    if (exam._count.examQuestions === 0) throw new AppError('Exam must have at least one question', 400);

    if (exam.totalQuestions !== exam._count.examQuestions) {
      await prisma.exam.update({
        where: { id: examId },
        data: { totalQuestions: exam._count.examQuestions },
      });
    }

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
      .onExamPublished(examId, updated.title)
      .catch((err) => logger.warn('Notification trigger onExamPublished failed:', err));

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

  async scheduleExam(examId: number, data: ScheduleExamInput, userId: number, role: string = 'teacher') {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { examAssignments: { select: { classId: true } } },
    });
    if (!exam) throw new AppError('Exam not found', 404);
    if (exam.createdBy !== userId && role !== 'admin') throw new AppError('You can only schedule your own exams', 403);

    if (exam.status !== 'DRAFT' && exam.status !== 'PUBLISHED') {
      throw new AppError('Only DRAFT or PUBLISHED exams can be scheduled', 400);
    }

    const assignedClassIds = (exam.examAssignments ?? []).map((a) => a.classId);

    // Phase 5: a per-class schedule must target a class the exam is assigned to.
    if (data.classId != null && !assignedClassIds.includes(data.classId)) {
      throw new AppError('The chosen class is not assigned to this exam', 400);
    }

    // Timetable / exam conflict check. Only runs once the exam is assigned to at
    // least one class — scheduling before assigning stays allowed (no regression).
    // Per-class schedules are checked only against their own class.
    const conflictClassIds = data.classId != null ? [data.classId] : assignedClassIds;
    if (conflictClassIds.length > 0) {
      const conflicts = await timetableService.checkExamScheduleConflicts({
        classIds: conflictClassIds,
        subjectId: exam.subjectId,
        startTime: data.startTime,
        endTime: data.endTime,
        excludeExamId: examId,
        room: data.room ?? null,
        proctorId: data.proctorId ?? null,
      });
      // Hard conflicts block; only an admin may force past them.
      const canForce = data.force === true && role === 'admin';
      if (conflicts.hardConflicts.length > 0 && !canForce) {
        throw new AppError(
          'Schedule conflicts detected',
          409,
          true,
          conflicts.hardConflicts,
          { softWarnings: conflicts.softWarnings },
        );
      }
    }

    const schedule = await prisma.examSchedule.create({
      data: {
        examId,
        classId: data.classId ?? null,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room ?? null,
        proctorId: data.proctorId ?? null,
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

    // Block assigning a class whose timetable/other-exams collide with an existing
    // schedule of this exam. Exams without schedules are unaffected (no regression).
    const schedules = await prisma.examSchedule.findMany({
      where: { examId, status: { in: ['PENDING', 'ACTIVE'] } },
      select: { startTime: true, endTime: true },
    });
    for (const schedule of schedules) {
      const conflicts = await timetableService.checkExamScheduleConflicts({
        classIds: newClassIds,
        subjectId: exam.subjectId,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        excludeExamId: examId,
      });
      if (conflicts.hardConflicts.length > 0) {
        throw new AppError(
          'Cannot assign class because schedule conflicts were found',
          409,
          true,
          conflicts.hardConflicts,
          { softWarnings: conflicts.softWarnings },
        );
      }
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
  // DELETE EXAM (DRAFT only)
  // ═══════════════════════════════════════════════

  async deleteExam(examId: number, userId: number, role: string = 'teacher') {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { _count: { select: { examAttempts: true } } },
    });
    if (!exam) throw new AppError('Exam not found', 404);

    const isAdmin = role === 'admin';

    // Teachers may delete only their own exams (any status); admins may delete any exam.
    if (!isAdmin && exam.createdBy !== userId) {
      throw new AppError('You can only delete your own exams', 403);
    }

    // An exam with student attempts holds graded results. Teachers are blocked
    // from deleting it; only an admin may force-delete, in which case the FK
    // cascade removes attempts, answers, monitoring events and any AI practice
    // sessions derived from those attempts.
    if (!isAdmin && exam._count.examAttempts > 0) {
      throw new AppError('Cannot delete an exam that already has attempts', 400);
    }

    // Related rows (examQuestions, examSchedules, examAssignments, examAttempts)
    // cascade via FK.
    await prisma.exam.delete({ where: { id: examId } });
    await this.invalidateExamDetail(examId);

    return {
      success: true,
      message: 'Exam deleted successfully',
      data: { id: examId },
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

  async getExamMonitoring(
    examId: number,
    userId: number,
    role: string,
    query: ExamMonitoringQuery = {},
  ) {
    const exam = await prisma.exam.findFirst({
      where: {
        id: examId,
        ...(role === 'admin' ? {} : { createdBy: userId }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        durationMin: true,
        totalQuestions: true,
        passingScore: true,
        examAssignments: {
          select: {
            classId: true,
            assignedAt: true,
            class: {
              select: {
                id: true,
                name: true,
                gradeLevel: true,
                classStudents: {
                  select: {
                    studentId: true,
                    student: {
                      select: {
                        id: true,
                        username: true,
                        fullName: true,
                        avatar: true,
                        studentProfile: {
                          select: {
                            studentCode: true,
                            homeroomClassName: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!exam) throw new AppError('Exam not found or unauthorized', 404);

    const assignments = query.classId
      ? exam.examAssignments.filter((assignment) => assignment.classId === query.classId)
      : exam.examAssignments;

    if (query.classId && assignments.length === 0) {
      throw new AppError('Exam is not assigned to this class', 404);
    }

    const studentMap = new Map<
      number,
      {
        studentId: number;
        studentName: string | null;
        studentUsername: string;
        avatar: string | null;
        studentCode: string | null;
        homeroomClassName: string | null;
        classes: { id: number; name: string; gradeLevel: number }[];
      }
    >();

    for (const assignment of assignments) {
      const cls = assignment.class;
      for (const classStudent of cls.classStudents) {
        const existing = studentMap.get(classStudent.studentId);
        const student = classStudent.student;
        const classInfo = { id: cls.id, name: cls.name, gradeLevel: cls.gradeLevel };

        if (existing) {
          if (!existing.classes.some((item) => item.id === cls.id)) {
            existing.classes.push(classInfo);
          }
          continue;
        }

        studentMap.set(classStudent.studentId, {
          studentId: student.id,
          studentName: student.fullName,
          studentUsername: student.username,
          avatar: student.avatar,
          studentCode: student.studentProfile?.studentCode ?? null,
          homeroomClassName: student.studentProfile?.homeroomClassName ?? null,
          classes: [classInfo],
        });
      }
    }

    const studentIds = [...studentMap.keys()];
    const attempts = studentIds.length > 0
      ? await prisma.examAttempt.findMany({
          where: { examId, studentId: { in: studentIds } },
          orderBy: [{ studentId: 'asc' }, { startedAt: 'desc' }],
          select: {
            id: true,
            examId: true,
            studentId: true,
            startedAt: true,
            submittedAt: true,
            isAutoSubmitted: true,
            totalScore: true,
            timeSpentSec: true,
            status: true,
            attemptAnswers: { select: { isCorrect: true } },
            securitySession: {
              select: {
                deviceId: true,
                ipAddress: true,
                userAgent: true,
                lastHeartbeatAt: true,
                fullscreenState: true,
                cameraPermission: true,
                screenSize: true,
                status: true,
              },
            },
            attemptViolations: {
              orderBy: { occurredAt: 'desc' },
              take: 100,
              select: {
                id: true,
                eventType: true,
                severity: true,
                riskPoints: true,
                message: true,
                occurredAt: true,
                reviewStatus: true,
                teacherNote: true,
              },
            },
            proctorReview: {
              select: {
                decision: true,
                finalRiskLevel: true,
                summary: true,
                updatedAt: true,
              },
            },
            attemptEvents: {
              orderBy: { occurredAt: 'desc' },
              take: 200,
              select: {
                id: true,
                type: true,
                occurredAt: true,
                clientElapsedSec: true,
                questionId: true,
                metadata: true,
              },
            },
          },
        })
      : [];

    const latestAttemptByStudent = new Map<number, (typeof attempts)[number]>();
    for (const attempt of attempts) {
      if (!latestAttemptByStudent.has(attempt.studentId)) {
        latestAttemptByStudent.set(attempt.studentId, attempt);
      }
    }

    const now = new Date();
    const durationSec = exam.durationMin * 60;

    const rows = [...studentMap.values()].map((student) => {
      const attempt = latestAttemptByStudent.get(student.studentId);

      if (!attempt) {
        return {
          student,
          attemptId: null,
          status: 'NOT_STARTED' as const,
          startedAt: null,
          submittedAt: null,
          score: null,
          passed: null,
          correctCount: 0,
          answeredQuestions: 0,
          totalQuestions: exam.totalQuestions,
          timeSpentSec: null,
          timeElapsedSec: null,
          timeRemainingSec: null,
          isAutoSubmitted: false,
          lastActivityAt: null,
          lastHeartbeatAt: null,
          violationCount: 0,
          tabSwitchCount: 0,
          copyPasteCount: 0,
          offlineCount: 0,
          blockedShortcutCount: 0,
          fullscreenExitCount: 0,
          deviceChangeCount: 0,
          cameraIssueCount: 0,
          riskScore: 0,
          riskLevel: 'low' as const,
          flags: [] as string[],
          recentEvents: [] as MonitoringEvent[],
          recentViolations: [],
          securitySession: null,
          review: null,
        };
      }

      const events = attempt.attemptEvents as MonitoringEvent[];
      const latestHeartbeat = events.find(
        (event) =>
          event.type === ExamAttemptEventType.HEARTBEAT ||
          event.type === ExamAttemptEventType.ANSWER_SAVED,
      );
      const lastActivityAt = events[0]?.occurredAt ?? attempt.submittedAt ?? attempt.startedAt;
      const elapsedSec = Math.max(
        0,
        Math.floor((now.getTime() - new Date(attempt.startedAt).getTime()) / 1000),
      );
      const timeSpentSec = attempt.status === 'IN_PROGRESS'
        ? elapsedSec
        : attempt.timeSpentSec ?? null;
      const timeRemainingSec = attempt.status === 'IN_PROGRESS'
        ? Math.max(0, durationSec - elapsedSec)
        : null;

      const answeredQuestions =
        metadataNumber(latestHeartbeat?.metadata ?? null, 'answeredCount') ??
        (attempt.status === 'IN_PROGRESS' ? 0 : attempt.attemptAnswers.length);
      const correctCount = attempt.attemptAnswers.filter((answer) => answer.isCorrect).length;
      const score = attempt.totalScore === null ? null : Number(attempt.totalScore);
      const passingScore = exam.passingScore === null ? null : Number(exam.passingScore);

      const tabSwitchCount = countEvents(events, ExamAttemptEventType.TAB_HIDDEN);
      const copyPasteCount =
        countEvents(events, ExamAttemptEventType.COPY) +
        countEvents(events, ExamAttemptEventType.PASTE) +
        countEvents(events, ExamAttemptEventType.CUT);
      const offlineCount = countEvents(events, ExamAttemptEventType.OFFLINE);
      const blockedShortcutCount = countEvents(events, ExamAttemptEventType.SHORTCUT_BLOCKED);
      const fullscreenExitCount = countEvents(events, ExamAttemptEventType.FULLSCREEN_EXITED);
      const deviceChangeCount = countEvents(events, ExamAttemptEventType.DEVICE_CHANGED);
      const cameraIssueCount = countEvents(events, ExamAttemptEventType.CAMERA_PERMISSION_MISSING);
      const activeViolations = attempt.attemptViolations.filter(
        (violation) =>
          violation.reviewStatus !== 'FALSE_POSITIVE' && violation.reviewStatus !== 'DISMISSED',
      );
      const rawViolationCount = events.filter((event) => MONITORING_VIOLATION_TYPES.has(event.type)).length;
      const violationCount = activeViolations.length > 0 ? activeViolations.length : rawViolationCount;

      let riskScore =
        activeViolations.length > 0
          ? activeViolations.reduce((total, violation) => total + violation.riskPoints, 0)
          : events.reduce((total, event) => total + (MONITORING_EVENT_WEIGHTS[event.type] ?? 0), 0);
      const flags: string[] = [];

      if (tabSwitchCount >= 3) flags.push(`Tab switched ${tabSwitchCount} times`);
      if (copyPasteCount > 0) flags.push(`Copy/paste ${copyPasteCount} times`);
      if (fullscreenExitCount > 0) flags.push(`Fullscreen exited ${fullscreenExitCount} times`);
      if (blockedShortcutCount > 0) flags.push(`Blocked shortcut ${blockedShortcutCount} times`);
      if (offlineCount > 0) flags.push(`Disconnected ${offlineCount} times`);
      if (deviceChangeCount > 0) flags.push('Device/session changed');
      if (cameraIssueCount > 0) flags.push('Camera permission issue');
      if (attempt.isAutoSubmitted) {
        flags.push('Auto-submitted');
      }

      if (attempt.status === 'IN_PROGRESS' && latestHeartbeat) {
        const secondsSinceHeartbeat = Math.floor(
          (now.getTime() - new Date(latestHeartbeat.occurredAt).getTime()) / 1000,
        );
        if (secondsSinceHeartbeat > 75) {
          riskScore += 10;
          flags.push('No recent heartbeat');
        }
      }

      if (
        attempt.status !== 'IN_PROGRESS' &&
        attempt.timeSpentSec !== null &&
        attempt.timeSpentSec < Math.max(60, durationSec * 0.2) &&
        score !== null &&
        score >= 8
      ) {
        riskScore += 10;
        flags.push('High score with very short time');
      }

      riskScore = Math.min(100, riskScore);
      const riskLevel = monitoringRiskLevel(riskScore);

      return {
        student,
        attemptId: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        score,
        passed: passingScore === null || score === null ? null : score >= passingScore,
        correctCount,
        answeredQuestions: Math.min(answeredQuestions, exam.totalQuestions),
        totalQuestions: exam.totalQuestions,
        timeSpentSec,
        timeElapsedSec: attempt.status === 'IN_PROGRESS' ? elapsedSec : null,
        timeRemainingSec,
        isAutoSubmitted: attempt.isAutoSubmitted,
        lastActivityAt,
        lastHeartbeatAt: latestHeartbeat?.occurredAt ?? null,
        violationCount,
        tabSwitchCount,
        copyPasteCount,
        offlineCount,
        blockedShortcutCount,
        fullscreenExitCount,
        deviceChangeCount,
        cameraIssueCount,
        riskScore,
        riskLevel,
        flags,
        recentEvents: events.slice(0, 10),
        recentViolations: attempt.attemptViolations.slice(0, 10),
        securitySession: attempt.securitySession,
        review: attempt.proctorReview,
      };
    });

    const completedRows = rows.filter((row) => row.status === 'SUBMITTED' || row.status === 'GRADED');
    const scores = completedRows
      .map((row) => row.score)
      .filter((score): score is number => typeof score === 'number');
    const passableRows = completedRows.filter((row) => row.passed !== null);
    const passedCount = passableRows.filter((row) => row.passed).length;

    rows.sort((a, b) => {
      const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, watch: 3, low: 4 };
      const statusOrder: Record<string, number> = {
        IN_PROGRESS: 0,
        NOT_STARTED: 1,
        SUBMITTED: 2,
        GRADED: 2,
      };
      const byRisk = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      if (byRisk !== 0) return byRisk;
      const byStatus = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      if (byStatus !== 0) return byStatus;
      return (a.student.studentName || a.student.studentUsername).localeCompare(
        b.student.studentName || b.student.studentUsername,
        'vi',
      );
    });

    return {
      success: true,
      message: 'Exam monitoring retrieved successfully',
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          status: exam.status,
          durationMin: exam.durationMin,
          totalQuestions: exam.totalQuestions,
          passingScore: exam.passingScore === null ? null : Number(exam.passingScore),
          classes: assignments.map((assignment) => ({
            id: assignment.class.id,
            name: assignment.class.name,
            gradeLevel: assignment.class.gradeLevel,
          })),
        },
        summary: {
          totalStudents: rows.length,
          notStarted: rows.filter((row) => row.status === 'NOT_STARTED').length,
          inProgress: rows.filter((row) => row.status === 'IN_PROGRESS').length,
          submitted: completedRows.length,
          autoSubmitted: rows.filter((row) => row.isAutoSubmitted).length,
          avgScore: scores.length > 0
            ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
            : null,
          passRate: passableRows.length > 0
            ? Math.round((passedCount / passableRows.length) * 10000) / 100
            : null,
          suspiciousCount: rows.filter((row) => row.riskLevel !== 'low').length,
          watchCount: rows.filter((row) => row.riskLevel === 'watch').length,
          mediumRiskCount: rows.filter((row) => row.riskLevel === 'medium').length,
          highRiskCount: rows.filter((row) => row.riskLevel === 'high').length,
          criticalRiskCount: rows.filter((row) => row.riskLevel === 'critical').length,
        },
        students: rows,
        updatedAt: now,
      },
    };
  }

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
      // Mark this window complete first.
      await prisma.examSchedule.update({
        where: { id: schedule.id },
        data: { status: 'COMPLETED' },
      });

      // Only close the whole exam once it has no further pending/active windows —
      // so a per-class schedule ending early does not lock out other classes.
      const remaining = await prisma.examSchedule.count({
        where: { examId: schedule.examId, status: { in: ['PENDING', 'ACTIVE'] } },
      });
      if (remaining === 0) {
        await prisma.exam.update({
          where: { id: schedule.examId },
          data: { status: 'CLOSED' },
        });
        emitExamClosed(schedule.examId, {
          examId: schedule.examId,
          title: schedule.exam.title,
        });
      }
    }

    const affectedExamIds = new Set<number>();
    for (const s of toActivate) affectedExamIds.add(s.examId);
    for (const s of toClose) affectedExamIds.add(s.examId);
    await Promise.all([...affectedExamIds].map((eid) => this.invalidateExamDetail(eid)));

    return { activated: toActivate.length, closed: toClose.length };
  }
}

export const examService = new ExamService();
