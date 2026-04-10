import '../../mocks/redis';
import '../../mocks/prisma';

import { prismaMock } from '../../mocks/prisma';

jest.mock('../../../socket', () => ({
  emitExamStarted: jest.fn(),
  emitExamClosed: jest.fn(),
  emitDashboardUpdateBulk: jest.fn(),
}));

jest.mock('../../../modules/notification/notification.service', () => ({
  notificationService: {
    onExamPublished: jest.fn().mockResolvedValue(undefined),
    onResultsPublished: jest.fn().mockResolvedValue(undefined),
    onExamAssigned: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../utils/cache', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheInvalidateExact: jest.fn().mockResolvedValue(undefined),
  cacheInvalidate: jest.fn().mockResolvedValue(undefined),
}));

import { ExamService } from '../../../modules/exam/exam.service';

const examService = new ExamService();

const mockExam = {
  id: 1,
  title: 'Math Exam 1',
  subjectId: 1,
  createdBy: 10,
  durationMin: 60,
  totalQuestions: 10,
  passingScore: null,
  shuffle: false,
  showResult: true,
  maxAttempts: 1,
  status: 'DRAFT' as const,
  createdAt: new Date(),
  subject: { id: 1, name: 'Math', code: 'MATH' },
  creator: { id: 10, fullName: 'Teacher One' },
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('ExamService', () => {
  describe('createExam', () => {
    it('should create an exam in DRAFT status', async () => {
      prismaMock.subject.findUnique.mockResolvedValue({ id: 1, name: 'Math', code: 'MATH' });
      prismaMock.exam.create.mockResolvedValue(mockExam);

      const result = await examService.createExam(
        {
          title: 'Math Exam 1',
          subjectId: 1,
          durationMin: 60,
          totalQuestions: 10,
          shuffle: false,
          showResult: true,
          maxAttempts: 1,
        },
        10,
      );

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('DRAFT');
      expect(prismaMock.exam.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DRAFT', createdBy: 10 }),
        }),
      );
    });

    it('should throw 404 if subject not found', async () => {
      prismaMock.subject.findUnique.mockResolvedValue(null);

      await expect(
        examService.createExam(
          {
            title: 'Test',
            subjectId: 999,
            durationMin: 60,
            totalQuestions: 10,
            shuffle: false,
            showResult: true,
            maxAttempts: 1,
          },
          10,
        ),
      ).rejects.toThrow('Subject not found');
    });
  });

  describe('updateExam', () => {
    it('should update a DRAFT exam', async () => {
      prismaMock.exam.findUnique.mockResolvedValue(mockExam);
      prismaMock.exam.update.mockResolvedValue({ ...mockExam, title: 'Updated' });

      const result = await examService.updateExam(
        1,
        { title: 'Updated' },
        10,
      );

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Updated');
    });

    it('should throw 403 if not the creator', async () => {
      prismaMock.exam.findUnique.mockResolvedValue(mockExam);

      await expect(
        examService.updateExam(1, { title: 'Hacked' }, 999),
      ).rejects.toThrow('You can only edit your own exams');
    });

    it('should throw 400 if exam is not DRAFT', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({
        ...mockExam,
        status: 'PUBLISHED',
      });

      await expect(
        examService.updateExam(1, { title: 'Changed' }, 10),
      ).rejects.toThrow('Only DRAFT exams can be edited');
    });
  });

  describe('publishExam', () => {
    it('should publish a DRAFT exam with questions', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({
        ...mockExam,
        totalQuestions: 5,
        _count: { examQuestions: 5 },
      });
      prismaMock.exam.update.mockResolvedValue({ ...mockExam, status: 'PUBLISHED' });
      prismaMock.examAssignment.findMany.mockResolvedValue([]);

      const result = await examService.publishExam(1, 10);

      expect(result.success).toBe(true);
      expect(prismaMock.exam.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'PUBLISHED' },
        }),
      );
    });

    it('should throw 400 if exam has no questions', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({
        ...mockExam,
        _count: { examQuestions: 0 },
      });

      await expect(examService.publishExam(1, 10)).rejects.toThrow(
        'Exam must have at least one question',
      );
    });

    it('should throw 400 if exam is not DRAFT', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({
        ...mockExam,
        status: 'PUBLISHED',
        _count: { examQuestions: 5 },
      });

      await expect(examService.publishExam(1, 10)).rejects.toThrow(
        'Only DRAFT exams can be published',
      );
    });
  });

  describe('scheduleExam', () => {
    it('should create schedule for DRAFT exam and set SCHEDULED status', async () => {
      prismaMock.exam.findUnique.mockResolvedValue(mockExam);
      prismaMock.examSchedule.create.mockResolvedValue({
        id: 1,
        examId: 1,
        startTime: new Date(),
        endTime: new Date(),
        status: 'PENDING',
      });
      prismaMock.exam.update.mockResolvedValue({ ...mockExam, status: 'SCHEDULED' });

      const startTime = new Date(Date.now() + 86400000);
      const endTime = new Date(Date.now() + 86400000 + 3600000);

      const result = await examService.scheduleExam(
        1,
        { startTime, endTime },
        10,
      );

      expect(result.success).toBe(true);
      expect(prismaMock.exam.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'SCHEDULED' },
        }),
      );
    });

    it('should throw 400 for CLOSED exams', async () => {
      prismaMock.exam.findUnique.mockResolvedValue({
        ...mockExam,
        status: 'CLOSED',
      });

      await expect(
        examService.scheduleExam(
          1,
          { startTime: new Date(), endTime: new Date() },
          10,
        ),
      ).rejects.toThrow('Only DRAFT or PUBLISHED exams can be scheduled');
    });
  });

  describe('addQuestions', () => {
    it('should add manual questions to DRAFT exam', async () => {
      prismaMock.exam.findUnique.mockResolvedValue(mockExam);
      prismaMock.question.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);
      prismaMock.examQuestion.findMany.mockResolvedValue([]);
      prismaMock.examQuestion.aggregate.mockResolvedValue({ _max: { orderIndex: 0 } });
      prismaMock.examQuestion.createMany.mockResolvedValue({ count: 2 });
      prismaMock.examQuestion.count.mockResolvedValue(2);
      prismaMock.examQuestion.updateMany.mockResolvedValue({ count: 2 });
      prismaMock.exam.update.mockResolvedValue({ ...mockExam, totalQuestions: 2 });
      prismaMock.$transaction.mockResolvedValue([
        { ...mockExam, totalQuestions: 2 },
        { count: 2 },
      ]);

      const result = await examService.addQuestions(
        1,
        { mode: 'manual', questionIds: [1, 2] },
        10,
      );

      expect(result.success).toBe(true);
      expect(result.data.added).toBe(2);
    });

    it('should throw 404 for missing questions in manual mode', async () => {
      prismaMock.exam.findUnique.mockResolvedValue(mockExam);
      prismaMock.question.findMany.mockResolvedValue([{ id: 1 }]);

      await expect(
        examService.addQuestions(1, { mode: 'manual', questionIds: [1, 999] }, 10),
      ).rejects.toThrow('Questions not found: 999');
    });
  });

  describe('assignExam', () => {
    it('should throw 400 when assigning DRAFT exam', async () => {
      prismaMock.exam.findUnique.mockResolvedValue(mockExam);

      await expect(
        examService.assignExam(1, { classIds: [1] }, 10),
      ).rejects.toThrow('Cannot assign a DRAFT exam');
    });
  });

  describe('listExams', () => {
    it('should filter by teacher when role is teacher', async () => {
      prismaMock.exam.findMany.mockResolvedValue([]);
      prismaMock.exam.count.mockResolvedValue(0);

      await examService.listExams({ page: 1, limit: 20 }, 10, 'teacher');

      expect(prismaMock.exam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdBy: 10 }),
        }),
      );
    });
  });
});
