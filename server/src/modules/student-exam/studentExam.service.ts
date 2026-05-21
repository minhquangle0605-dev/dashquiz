import { Prisma, AttemptStatus, ExamAttemptEventType } from '@prisma/client';
import { prisma } from '../../config/database';
import { getRedisClient } from '../../config/redis';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { PAGINATION, COMPLETED_ATTEMPT_STATUSES } from '../../utils/constants';
import { invalidateStudentCache } from '../analytics/analytics.service';
import { notificationService } from '../notification/notification.service';
import { emitStudentSubmitted, emitDashboardUpdate, emitAttemptEvent } from '../../socket';
import type {
  ListStudentExamsQuery,
  SaveAnswersInput,
  SubmitAttemptInput,
  AttemptEventInput,
  ListAttemptsQuery,
} from './studentExam.validation';

const REDIS_KEY_PREFIX = 'attempt';
const BUFFER_MINUTES = 5;

type StudentAnswerValue =
  | number
  | number[]
  | string
  | Record<string, string>
  | null;

function redisAnswerKey(attemptId: number): string {
  return `${REDIS_KEY_PREFIX}:${attemptId}:answers`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeTextAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function splitShortAnswerAlternatives(answer: string): string[] {
  const alternatives: string[] = [];
  let current = '';
  const stack: string[] = [];
  let quote: string | null = null;
  const matchingClose: Record<string, string> = {
    '[': ']',
    '(': ')',
    '{': '}',
  };

  for (const char of answer) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      current += char;
      quote = char;
      continue;
    }

    if (char === '[' || char === '(' || char === '{') {
      stack.push(matchingClose[char]);
      current += char;
      continue;
    }

    if (stack.length > 0 && char === stack[stack.length - 1]) {
      stack.pop();
      current += char;
      continue;
    }

    if (char === ';' && stack.length === 0) {
      if (current.trim()) alternatives.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) alternatives.push(current.trim());
  return alternatives;
}

function normalizeSelectedIds(value: StudentAnswerValue): number[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))].sort(
      (a, b) => a - b,
    );
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return [value];
  }
  return [];
}

function metadataToJson(
  metadata: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!metadata) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
}

function countAnsweredValues(answers: Record<string, StudentAnswerValue>): number {
  return Object.values(answers).filter((value) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'object') return Object.values(value).some((v) => String(v).trim());
    return true;
  }).length;
}

function splitMatchingPair(content: string): [string, string] | null {
  const [left = '', ...rightParts] = content.split(/\s*=>\s*/);
  const right = rightParts.join(' => ').trim();
  if (!left.trim() || !right) return null;
  return [left.trim(), right];
}

export class StudentExamService {
  private async createAttemptEvent(
    attemptId: number,
    type: ExamAttemptEventType,
    options: {
      clientElapsedSec?: number;
      questionId?: number;
      metadata?: Record<string, unknown>;
    } = {},
  ) {
    return prisma.examAttemptEvent.create({
      data: {
        attemptId,
        type,
        clientElapsedSec: options.clientElapsedSec ?? null,
        questionId: options.questionId ?? null,
        metadata: metadataToJson(options.metadata),
      },
    });
  }

  async recordAttemptEvent(attemptId: number, data: AttemptEventInput, studentId: number) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: { select: { id: true, fullName: true, username: true } },
        exam: {
          select: {
            id: true,
            durationMin: true,
            examQuestions: { select: { questionId: true } },
          },
        },
      },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.studentId !== studentId) throw new AppError('Access denied', 403);
    if (attempt.status !== 'IN_PROGRESS') {
      throw new AppError('This attempt is no longer active', 400);
    }

    if (
      data.questionId &&
      !attempt.exam.examQuestions.some((question) => question.questionId === data.questionId)
    ) {
      throw new AppError('Question does not belong to this exam', 400);
    }

    const elapsed = Math.max(
      0,
      data.clientElapsedSec ??
        Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000),
    );

    const event = await this.createAttemptEvent(attemptId, data.type as ExamAttemptEventType, {
      clientElapsedSec: elapsed,
      questionId: data.questionId,
      metadata: data.metadata,
    });

    emitAttemptEvent(attempt.examId, {
      attemptId,
      studentId: attempt.studentId,
      studentName: attempt.student.fullName || attempt.student.username || 'Học sinh',
      type: event.type,
      occurredAt: event.occurredAt,
      clientElapsedSec: event.clientElapsedSec,
      questionId: event.questionId,
      metadata: event.metadata,
    });

    return {
      success: true,
      message: 'Attempt event recorded',
      data: {
        id: event.id,
        attemptId: event.attemptId,
        type: event.type,
        occurredAt: event.occurredAt,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // LIST EXAMS ASSIGNED TO STUDENT
  // UC05: Xem DS bài kiểm tra
  // ═══════════════════════════════════════════════

  async listStudentExams(query: ListStudentExamsQuery, studentId: number) {
    const page = query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const enrolledClasses = await prisma.classStudent.findMany({
      where: { studentId },
      select: { classId: true },
    });
    let classIds = enrolledClasses.map((cs) => cs.classId);

    if (query.classId) {
      if (!classIds.includes(query.classId)) {
        return {
          success: true,
          message: 'No exams found — you are not enrolled in this class',
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        };
      }
      classIds = [query.classId];
    }

    if (classIds.length === 0) {
      return {
        success: true,
        message: 'No exams found — student not enrolled in any class',
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };
    }

    const assignedExamIds = await prisma.examAssignment.findMany({
      where: { classId: { in: classIds } },
      select: { examId: true },
      distinct: ['examId'],
    });
    const examIds = assignedExamIds.map((a) => a.examId);

    if (examIds.length === 0) {
      return {
        success: true,
        message: 'No exams assigned to your classes',
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };
    }

    const baseWhere: Prisma.ExamWhereInput = {
      id: { in: examIds },
      status: { in: ['PUBLISHED', 'SCHEDULED', 'CLOSED'] },
    };

    if (query.subjectId) {
      baseWhere.subjectId = query.subjectId;
    }

    const allExams = await prisma.exam.findMany({
      where: baseWhere,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, fullName: true } },
        examSchedules: {
          orderBy: { startTime: 'desc' },
          take: 1,
        },
        examAttempts: {
          where: { studentId },
          select: { id: true, status: true, totalScore: true, submittedAt: true, startedAt: true },
        },
        _count: { select: { examQuestions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const enriched = allExams.map((exam) => {
      const attempts = exam.examAttempts;
      const hasInProgress = attempts.some((a) => a.status === 'IN_PROGRESS');
      const completedAttempts = attempts.filter(
        (a) => (COMPLETED_ATTEMPT_STATUSES as readonly string[]).includes(a.status),
      );
      const bestScore = completedAttempts.length > 0
        ? Math.max(...completedAttempts.map((a) => Number(a.totalScore ?? 0)))
        : null;
      const schedule = exam.examSchedules[0] ?? null;
      const maxedOut = completedAttempts.length >= exam.maxAttempts;

      const isOpen = exam.status === 'PUBLISHED';
      const isScheduledAndActive = schedule
        && schedule.status === 'ACTIVE'
        && new Date(schedule.startTime) <= now
        && new Date(schedule.endTime) > now;
      const isAvailable = isOpen || isScheduledAndActive;

      let examPhase: 'upcoming' | 'in_progress' | 'completed';
      if (hasInProgress) {
        examPhase = 'in_progress';
      } else if (maxedOut || exam.status === 'CLOSED') {
        examPhase = 'completed';
      } else if (isAvailable && completedAttempts.length > 0 && !maxedOut) {
        examPhase = 'in_progress';
      } else if (isAvailable) {
        examPhase = 'upcoming';
      } else if (schedule && new Date(schedule.startTime) > now) {
        examPhase = 'upcoming';
      } else {
        examPhase = 'completed';
      }

      const canStart = isAvailable && !hasInProgress && !maxedOut;

      const { examAttempts, ...examData } = exam;
      return {
        ...examData,
        phase: examPhase,
        attemptCount: attempts.length,
        completedCount: completedAttempts.length,
        bestScore,
        hasInProgress,
        canStart,
      };
    });

    let filtered = enriched;
    if (query.filter && query.filter !== 'all') {
      filtered = enriched.filter((e) => e.phase === query.filter);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const paginated = filtered.slice(skip, skip + limit);

    return {
      success: true,
      message: 'Student exams retrieved successfully',
      data: paginated,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  // ═══════════════════════════════════════════════
  // START EXAM
  // UC06: Làm bài kiểm tra — tạo attempt, trả câu hỏi
  // ═══════════════════════════════════════════════

  async startExam(examId: number, studentId: number) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examQuestions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            question: {
              include: {
                options: {
                  select: { id: true, label: true, content: true },
                  orderBy: { label: 'asc' },
                },
              },
            },
          },
        },
        examAssignments: {
          select: { classId: true },
        },
      },
    });

    if (!exam) throw new AppError('Exam not found', 404);
    if (exam.status !== 'PUBLISHED') {
      const activeSchedule = await prisma.examSchedule.findFirst({
        where: {
          examId,
          status: 'ACTIVE',
          startTime: { lte: new Date() },
          endTime: { gt: new Date() },
        },
      });
      if (!activeSchedule) {
        throw new AppError('This exam is not currently available', 400);
      }
    }

    const assignedClassIds = exam.examAssignments.map((a) => a.classId);
    const enrollment = await prisma.classStudent.findFirst({
      where: { studentId, classId: { in: assignedClassIds } },
    });
    if (!enrollment) {
      throw new AppError('You are not assigned to take this exam', 403);
    }

    const existingAttempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId, status: 'IN_PROGRESS' },
    });

    if (existingAttempt) {
      const elapsed = Math.floor(
        (Date.now() - new Date(existingAttempt.startedAt).getTime()) / 1000,
      );
      const durationSec = exam.durationMin * 60;

      if (elapsed >= durationSec) {
        await this.autoSubmitAttempt(existingAttempt.id);
        // Fall through to create new attempt below
      } else {
        const savedAnswers = await this.getSavedAnswers(existingAttempt.id);
        await this.createAttemptEvent(existingAttempt.id, ExamAttemptEventType.RESUMED, {
          clientElapsedSec: elapsed,
          metadata: {
            answeredCount: countAnsweredValues(savedAnswers),
            remainingSec: Math.max(0, durationSec - elapsed),
          },
        });

        let questions = exam.examQuestions.map((eq) => ({
          questionId: eq.questionId,
          orderIndex: eq.orderIndex,
          points: eq.points,
          content: eq.question.content,
          questionType: eq.question.questionType,
          options: eq.question.options,
        }));

        if (exam.shuffle) {
          questions = shuffleArray(questions);
        }

        return {
          success: true,
          message: 'Resuming existing attempt',
          data: {
            attempt: {
              id: existingAttempt.id,
              examId: exam.id,
              startedAt: existingAttempt.startedAt,
              timeElapsedSec: elapsed,
              timeRemainingsSec: Math.max(0, durationSec - elapsed),
            },
            exam: {
              id: exam.id,
              title: exam.title,
              durationMin: exam.durationMin,
              totalQuestions: exam.totalQuestions,
              shuffle: exam.shuffle,
            },
            questions,
            savedAnswers,
          },
        };
      }
    }

    const completedCount = await prisma.examAttempt.count({
      where: {
        examId,
        studentId,
        status: { in: ['SUBMITTED', 'GRADED'] },
      },
    });

    if (completedCount >= exam.maxAttempts) {
      throw new AppError(
        `Maximum attempts reached (${exam.maxAttempts}). You cannot retake this exam.`,
        400,
      );
    }

    const activeAttempt = await prisma.examAttempt.findFirst({
      where: { examId, studentId, status: 'IN_PROGRESS' },
    });
    if (activeAttempt) {
      throw new AppError('You already have an active attempt for this exam', 409);
    }

    const attempt = await prisma.examAttempt.create({
      data: {
        examId,
        studentId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    await this.createAttemptEvent(attempt.id, ExamAttemptEventType.STARTED, {
      clientElapsedSec: 0,
      metadata: { durationSec: exam.durationMin * 60 },
    });

    const redis = getRedisClient();
    const ttl = (exam.durationMin + BUFFER_MINUTES) * 60;
    await redis.set(redisAnswerKey(attempt.id), JSON.stringify({}), 'EX', ttl);

    let questions = exam.examQuestions.map((eq) => ({
      questionId: eq.questionId,
      orderIndex: eq.orderIndex,
      points: eq.points,
      content: eq.question.content,
      questionType: eq.question.questionType,
      options: eq.question.options,
    }));

    if (exam.shuffle) {
      questions = shuffleArray(questions);
    }

    return {
      success: true,
      message: 'Exam started successfully',
      data: {
        attempt: {
          id: attempt.id,
          examId: exam.id,
          startedAt: attempt.startedAt,
          timeElapsedSec: 0,
          timeRemainingsSec: exam.durationMin * 60,
        },
        exam: {
          id: exam.id,
          title: exam.title,
          durationMin: exam.durationMin,
          totalQuestions: exam.totalQuestions,
          shuffle: exam.shuffle,
        },
        questions,
        savedAnswers: {},
      },
    };
  }

  // ═══════════════════════════════════════════════
  // AUTO-SAVE ANSWERS → Redis
  // ═══════════════════════════════════════════════

  async saveAnswers(attemptId: number, data: SaveAnswersInput, studentId: number) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.studentId !== studentId) throw new AppError('Access denied', 403);
    if (attempt.status !== 'IN_PROGRESS') {
      throw new AppError('This attempt has already been submitted', 400);
    }

    const elapsed = Math.floor(
      (Date.now() - new Date(attempt.startedAt).getTime()) / 1000,
    );
    const durationSec = attempt.exam.durationMin * 60;
    if (elapsed > durationSec + BUFFER_MINUTES * 60) {
      await this.autoSubmitAttempt(attemptId);
      throw new AppError('Time expired — your exam has been auto-submitted', 400);
    }

    const redis = getRedisClient();
    const key = redisAnswerKey(attemptId);
    const existing = await redis.get(key);
    const merged = existing ? { ...JSON.parse(existing), ...data.answers } : { ...data.answers };

    const ttl = Math.max(60, (durationSec + BUFFER_MINUTES * 60) - elapsed);
    await redis.set(key, JSON.stringify(merged), 'EX', ttl);

    await this.createAttemptEvent(attemptId, ExamAttemptEventType.ANSWER_SAVED, {
      clientElapsedSec: elapsed,
      metadata: {
        savedCount: Object.keys(merged).length,
        answeredCount: countAnsweredValues(merged),
        remainingSec: Math.max(0, durationSec - elapsed),
      },
    });

    return {
      success: true,
      message: 'Answers saved successfully',
      data: {
        savedCount: Object.keys(merged).length,
        timeElapsedSec: elapsed,
        timeRemainingsSec: Math.max(0, durationSec - elapsed),
      },
    };
  }

  // ═══════════════════════════════════════════════
  // SUBMIT ATTEMPT
  // UC07: Nộp bài kiểm tra
  // ═══════════════════════════════════════════════

  async submitAttempt(attemptId: number, data: SubmitAttemptInput, studentId: number) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: {
              include: {
                question: {
                  include: {
                    options: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.studentId !== studentId) throw new AppError('Access denied', 403);
    if (attempt.status !== 'IN_PROGRESS') {
      throw new AppError('This attempt has already been submitted', 400);
    }

    return this.processSubmission(attempt, data?.answers, false);
  }

  // ═══════════════════════════════════════════════
  // GET RESULT
  // UC09: Xem kết quả & đáp án
  // ═══════════════════════════════════════════════

  async getAttemptResult(attemptId: number, studentId: number) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
          },
        },
        attemptAnswers: {
          include: {
            question: {
              include: {
                options: { orderBy: { label: 'asc' } },
                chapter: { select: { id: true, name: true } },
                topic: { select: { id: true, name: true } },
              },
            },
            selectedOption: { select: { id: true, label: true, content: true } },
          },
        },
      },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.studentId !== studentId) throw new AppError('Access denied', 403);

    if (attempt.status === 'IN_PROGRESS') {
      throw new AppError('Exam has not been submitted yet', 400);
    }

    const isCompleted = (COMPLETED_ATTEMPT_STATUSES as readonly string[]).includes(attempt.status);
    if (!attempt.exam.showResult && !isCompleted) {
      return {
        success: true,
        message: 'Results are not available yet. Please wait for your teacher to release results.',
        data: {
          attempt: {
            id: attempt.id,
            examId: attempt.examId,
            status: attempt.status,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            isAutoSubmitted: attempt.isAutoSubmitted,
          },
          resultsAvailable: false,
        },
      };
    }

    const correctCount = attempt.attemptAnswers.filter((a) => a.isCorrect).length;
    const totalQuestions = attempt.attemptAnswers.length;
    const scorePercentage = totalQuestions > 0
      ? parseFloat(((correctCount / totalQuestions) * 100).toFixed(1))
      : 0;

    const questionDetails = attempt.attemptAnswers.map((ans) => {
      const correctOptions = ans.question.options.filter((o) => o.isCorrect);
      const selectedOptionIds = Array.isArray(ans.selectedOptionIds)
        ? ans.selectedOptionIds.filter((id): id is number => typeof id === 'number')
        : [];
      const selectedOptions = ans.question.options
        .filter((o) => selectedOptionIds.includes(o.id))
        .map((o) => ({
          id: o.id,
          label: o.label,
          content: o.content,
        }));
      return {
        questionId: ans.questionId,
        content: ans.question.content,
        questionType: ans.question.questionType,
        chapter: ans.question.chapter,
        topic: ans.question.topic,
        explanation: ans.question.explanation,
        selectedOption: ans.selectedOption,
        selectedOptions,
        answerText: ans.answerText,
        correctOptions: correctOptions.map((o) => ({
          id: o.id,
          label: o.label,
          content: o.content,
        })),
        allOptions: ans.question.options.map((o) => ({
          id: o.id,
          label: o.label,
          content: o.content,
          isCorrect: o.isCorrect,
        })),
        isCorrect: ans.isCorrect,
        timeSpentSec: ans.timeSpentSec,
        answerChanges: ans.answerChanges,
      };
    });

    return {
      success: true,
      message: 'Attempt result retrieved successfully',
      data: {
        attempt: {
          id: attempt.id,
          examId: attempt.examId,
          examTitle: attempt.exam.title,
          subject: attempt.exam.subject,
          status: attempt.status,
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt,
          isAutoSubmitted: attempt.isAutoSubmitted,
          totalScore: attempt.totalScore,
          timeSpentSec: attempt.timeSpentSec,
          passingScore: attempt.exam.passingScore,
          durationMin: attempt.exam.durationMin,
        },
        summary: {
          totalQuestions,
          correctCount,
          incorrectCount: totalQuestions - correctCount,
          scorePercentage,
          passed: attempt.exam.passingScore
            ? Number(attempt.totalScore) >= Number(attempt.exam.passingScore)
            : null,
        },
        questions: questionDetails,
        resultsAvailable: true,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // LIST ALL ATTEMPTS (HISTORY)
  // UC15: Xem lịch sử bài KT
  // ═══════════════════════════════════════════════

  async listAttempts(query: ListAttemptsQuery, studentId: number) {
    const page = query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Prisma.ExamAttemptWhereInput = { studentId };
    if (query.examId) {
      where.examId = query.examId;
    }

    const [attempts, total] = await Promise.all([
      prisma.examAttempt.findMany({
        where,
        include: {
          exam: {
            include: {
              subject: { select: { id: true, name: true, code: true } },
              creator: { select: { id: true, fullName: true } },
            },
          },
          _count: { select: { attemptAnswers: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.examAttempt.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const data = attempts.map((a) => ({
      id: a.id,
      examId: a.examId,
      examTitle: a.exam.title,
      subject: a.exam.subject,
      creator: a.exam.creator,
      status: a.status,
      totalScore: a.totalScore,
      timeSpentSec: a.timeSpentSec,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      isAutoSubmitted: a.isAutoSubmitted,
      totalQuestions: a._count.attemptAnswers,
      durationMin: a.exam.durationMin,
      passingScore: a.exam.passingScore,
    }));

    return {
      success: true,
      message: 'Attempts retrieved successfully',
      data,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  // ═══════════════════════════════════════════════
  // INTERNAL: Process submission (manual or auto)
  // ═══════════════════════════════════════════════

  private async processSubmission(
    attempt: NonNullable<Awaited<ReturnType<typeof this.getAttemptWithExam>>>,
    requestAnswers?: Record<string, StudentAnswerValue>,
    isAuto = false,
  ) {
    const redis = getRedisClient();
    const key = redisAnswerKey(attempt.id);

    let answers: Record<string, StudentAnswerValue> = {};
    const redisData = await redis.get(key);
    if (redisData) {
      answers = JSON.parse(redisData);
    }
    if (requestAnswers) {
      answers = { ...answers, ...requestAnswers };
    }

    const now = new Date();
    const timeSpentSec = Math.floor(
      (now.getTime() - new Date(attempt.startedAt).getTime()) / 1000,
    );
    const maxDurationSec = attempt.exam.durationMin * 60;
    const validatedTimeSpent = Math.min(timeSpentSec, maxDurationSec + BUFFER_MINUTES * 60);

    const examQuestions = attempt.exam.examQuestions;
    let totalScore = new Prisma.Decimal(0);

    const attemptAnswerData: {
      attemptId: number;
      questionId: number;
      selectedOptionId: number | null;
      selectedOptionIds: Prisma.InputJsonValue | typeof Prisma.JsonNull;
      answerText: string | null;
      isCorrect: boolean;
      timeSpentSec: number | null;
      answerChanges: number;
    }[] = [];

    for (const eq of examQuestions) {
      const questionIdStr = String(eq.questionId);
      const selectedAnswer = (answers[questionIdStr] ?? null) as StudentAnswerValue;

      let selectedOptionId: number | null = null;
      let selectedOptionIds: number[] | null = null;
      let answerText: string | null = null;
      let isCorrect = false;

      if (eq.question.questionType === 'MULTIPLE_CHOICE') {
        const selectedIds = normalizeSelectedIds(selectedAnswer);
        const correctIds = eq.question.options
          .filter((option) => option.isCorrect)
          .map((option) => option.id)
          .sort((a, b) => a - b);
        selectedOptionIds = selectedIds.length > 0 ? selectedIds : null;
        selectedOptionId = selectedIds[0] ?? null;
        isCorrect =
          selectedIds.length > 0 &&
          selectedIds.length === correctIds.length &&
          selectedIds.every((id, idx) => id === correctIds[idx]);
      } else if (eq.question.questionType === 'SHORT_ANSWER') {
        answerText = typeof selectedAnswer === 'string' ? selectedAnswer : null;
        const normalized = answerText ? normalizeTextAnswer(answerText) : '';
        const accepted = eq.question.options
          .filter((option) => option.isCorrect)
          .flatMap((option) => splitShortAnswerAlternatives(option.content))
          .map(normalizeTextAnswer)
          .filter(Boolean);
        isCorrect = normalized.length > 0 && accepted.includes(normalized);
      } else if (eq.question.questionType === 'MATCHING') {
        const response =
          selectedAnswer && typeof selectedAnswer === 'object' && !Array.isArray(selectedAnswer)
            ? selectedAnswer
            : {};
        answerText = JSON.stringify(response);
        const pairs = eq.question.options
          .map((option) => {
            const pair = splitMatchingPair(option.content);
            return pair ? { label: option.label, right: normalizeTextAnswer(pair[1]) } : null;
          })
          .filter((pair): pair is { label: string; right: string } => pair !== null);
        isCorrect =
          pairs.length > 0 &&
          pairs.every((pair) => normalizeTextAnswer(response[pair.label] || '') === pair.right);
      } else {
        const selectedIds = normalizeSelectedIds(selectedAnswer);
        selectedOptionId = selectedIds[0] ?? null;
        if (selectedOptionId !== null) {
          const correctOption = eq.question.options.find((o) => o.isCorrect);
          isCorrect = correctOption?.id === selectedOptionId;
        }
      }

      if (isCorrect) {
        totalScore = totalScore.add(eq.points);
      }

      attemptAnswerData.push({
        attemptId: attempt.id,
        questionId: eq.questionId,
        selectedOptionId,
        selectedOptionIds: selectedOptionIds ?? Prisma.JsonNull,
        answerText,
        isCorrect,
        timeSpentSec: null,
        answerChanges: 0,
      });
    }

    const correctCount = attemptAnswerData.filter((a) => a.isCorrect).length;

    await prisma.$transaction(async (tx) => {
      await tx.examAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'SUBMITTED' as AttemptStatus,
          submittedAt: now,
          totalScore,
          timeSpentSec: validatedTimeSpent,
          isAutoSubmitted: isAuto,
        },
      });

      if (attemptAnswerData.length > 0) {
        await tx.attemptAnswer.deleteMany({ where: { attemptId: attempt.id } });
        await tx.attemptAnswer.createMany({ data: attemptAnswerData });
      }

      await tx.examAttemptEvent.create({
        data: {
          attemptId: attempt.id,
          type: isAuto ? ExamAttemptEventType.AUTO_SUBMITTED : ExamAttemptEventType.SUBMITTED,
          clientElapsedSec: validatedTimeSpent,
          metadata: {
            totalScore: Number(totalScore),
            totalQuestions: examQuestions.length,
            correctCount,
            answeredCount: countAnsweredValues(answers),
          },
        },
      });
    });

    try {
      await redis.del(key);
    } catch (err) {
      logger.warn(`Failed to delete Redis key ${key}:`, err);
    }

    invalidateStudentCache(attempt.studentId).catch((err) =>
      logger.warn('Failed to invalidate analytics cache:', err),
    );

    // Real-time: emit exam:student-submitted so teacher sees it live
    const student = await prisma.user.findUnique({
      where: { id: attempt.studentId },
      select: { fullName: true, username: true },
    });
    emitStudentSubmitted(attempt.examId, {
      attemptId: attempt.id,
      studentId: attempt.studentId,
      studentName: student?.fullName || student?.username || 'Học sinh',
      totalScore: Number(totalScore),
      totalQuestions: examQuestions.length,
      correctCount,
      isAutoSubmitted: isAuto,
      submittedAt: now,
    });

    // Invalidate student's dashboard cache via socket
    emitDashboardUpdate(attempt.studentId, {
      reason: 'exam_submitted',
      entityType: 'exam_attempt',
      entityId: attempt.id,
    });

    notificationService
      .onExamSubmitted(
        attempt.studentId,
        attempt.exam.title,
        Number(totalScore),
        examQuestions.length,
        correctCount,
      )
      .catch((err) => logger.warn('Notification trigger onExamSubmitted failed:', err));

    return {
      success: true,
      message: isAuto ? 'Exam auto-submitted (time expired)' : 'Exam submitted successfully',
      data: {
        attemptId: attempt.id,
        totalScore: Number(totalScore),
        totalQuestions: examQuestions.length,
        correctCount,
        incorrectCount: examQuestions.length - correctCount,
        timeSpentSec: validatedTimeSpent,
        isAutoSubmitted: isAuto,
        submittedAt: now,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // INTERNAL: Get full attempt for submission
  // ═══════════════════════════════════════════════

  private async getAttemptWithExam(attemptId: number) {
    return prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: {
              include: {
                question: {
                  include: { options: true },
                },
              },
            },
          },
        },
      },
    });
  }

  // ═══════════════════════════════════════════════
  // AUTO-SUBMIT SINGLE ATTEMPT
  // ═══════════════════════════════════════════════

  async autoSubmitAttempt(attemptId: number) {
    const attempt = await this.getAttemptWithExam(attemptId);
    if (!attempt || attempt.status !== 'IN_PROGRESS') return;

    try {
      await this.processSubmission(attempt, undefined, true);
      logger.info(`[AutoSubmit] Attempt ${attemptId} auto-submitted`);
    } catch (error) {
      logger.error(`[AutoSubmit] Failed for attempt ${attemptId}:`, error);
    }
  }

  // ═══════════════════════════════════════════════
  // CRON: Auto-submit expired attempts
  // UC08: Tự động nộp khi hết giờ
  // ═══════════════════════════════════════════════

  async autoSubmitExpiredAttempts() {
    const now = new Date();

    const expiredAttempts = await prisma.$queryRaw<
      Array<{ id: number; started_at: Date; duration_min: number }>
    >`
      SELECT ea.id, ea.started_at, e.duration_min
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ea.status = 'IN_PROGRESS'
        AND ea.started_at + (e.duration_min || ' minutes')::interval < ${now}
    `;

    let submitted = 0;
    for (const expired of expiredAttempts) {
      try {
        await this.autoSubmitAttempt(expired.id);
        submitted++;
      } catch (error) {
        logger.error(`[Cron] Auto-submit failed for attempt ${expired.id}:`, error);
      }
    }

    return { submitted, total: expiredAttempts.length };
  }

  // ═══════════════════════════════════════════════
  // INTERNAL: Get saved answers from Redis
  // ═══════════════════════════════════════════════

  private async getSavedAnswers(attemptId: number): Promise<Record<string, StudentAnswerValue>> {
    try {
      const redis = getRedisClient();
      const data = await redis.get(redisAnswerKey(attemptId));
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }
}

export const studentExamService = new StudentExamService();
