import '../../mocks/redis';
import '../../mocks/prisma';

import { prismaMock } from '../../mocks/prisma';

jest.mock('../../../utils/cache', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheInvalidate: jest.fn().mockResolvedValue(undefined),
  cacheInvalidateExact: jest.fn().mockResolvedValue(undefined),
}));

import { QuestionService } from '../../../modules/question/question.service';

const questionService = new QuestionService();

const mockQuestion = {
  id: 1,
  subjectId: 1,
  chapterId: 1,
  topicId: 1,
  content: 'What is 2+2?',
  questionType: 'SINGLE_CHOICE' as const,
  difficulty: 1,
  explanation: 'Basic arithmetic',
  createdBy: 10,
  createdAt: new Date(),
  subject: { id: 1, name: 'Mathematics', code: 'MATH' },
  chapter: { id: 1, name: 'Arithmetic' },
  topic: { id: 1, name: 'Addition' },
  options: [
    { id: 1, questionId: 1, label: 'A', content: '3', isCorrect: false },
    { id: 2, questionId: 1, label: 'B', content: '4', isCorrect: true },
    { id: 3, questionId: 1, label: 'C', content: '5', isCorrect: false },
    { id: 4, questionId: 1, label: 'D', content: '6', isCorrect: false },
  ],
  tags: [],
  creator: { id: 10, fullName: 'Teacher One' },
  _count: { examQuestions: 0 },
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('QuestionService', () => {
  describe('createQuestion', () => {
    it('should create a question with options', async () => {
      prismaMock.subject.findUnique.mockResolvedValue({ id: 1, name: 'Mathematics', code: 'MATH', description: '', status: 1 });
      prismaMock.chapter.findUnique.mockResolvedValue({ id: 1, subjectId: 1, name: 'Arithmetic', gradeLevel: 10, orderIndex: 1 });
      prismaMock.topic.findUnique.mockResolvedValue({ id: 1, chapterId: 1, name: 'Addition', description: '' });
      prismaMock.question.create.mockResolvedValue(mockQuestion);

      const result = await questionService.createQuestion(
        {
          subjectId: 1,
          chapterId: 1,
          topicId: 1,
          content: 'What is 2+2?',
          questionType: 'SINGLE_CHOICE',
          difficulty: 1,
          explanation: 'Basic arithmetic',
          options: [
            { label: 'A', content: '3', isCorrect: false },
            { label: 'B', content: '4', isCorrect: true },
            { label: 'C', content: '5', isCorrect: false },
            { label: 'D', content: '6', isCorrect: false },
          ],
        },
        10,
      );

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('What is 2+2?');
    });

    it('should throw 404 if subject not found', async () => {
      prismaMock.subject.findUnique.mockResolvedValue(null);
      prismaMock.chapter.findUnique.mockResolvedValue({ id: 1, subjectId: 1, name: 'Ch1', gradeLevel: 10, orderIndex: 1 });
      prismaMock.topic.findUnique.mockResolvedValue({ id: 1, chapterId: 1, name: 'T1', description: '' });

      await expect(
        questionService.createQuestion(
          {
            subjectId: 999,
            chapterId: 1,
            topicId: 1,
            content: 'Test?',
            questionType: 'SINGLE_CHOICE',
            difficulty: 1,
            options: [
              { label: 'A', content: 'a', isCorrect: true },
              { label: 'B', content: 'b', isCorrect: false },
              { label: 'C', content: 'c', isCorrect: false },
              { label: 'D', content: 'd', isCorrect: false },
            ],
          },
          10,
        ),
      ).rejects.toThrow('Subject not found');
    });

    it('should throw 400 if chapter does not belong to subject', async () => {
      prismaMock.subject.findUnique.mockResolvedValue({ id: 1, name: 'Mathematics', code: 'MATH', description: '', status: 1 });
      prismaMock.chapter.findUnique.mockResolvedValue({ id: 2, subjectId: 2, name: 'Physics Ch', gradeLevel: 10, orderIndex: 1 });
      prismaMock.topic.findUnique.mockResolvedValue({ id: 1, chapterId: 2, name: 'T1', description: '' });

      await expect(
        questionService.createQuestion(
          {
            subjectId: 1,
            chapterId: 2,
            topicId: 1,
            content: 'Test?',
            questionType: 'SINGLE_CHOICE',
            difficulty: 1,
            options: [
              { label: 'A', content: 'a', isCorrect: true },
              { label: 'B', content: 'b', isCorrect: false },
              { label: 'C', content: 'c', isCorrect: false },
              { label: 'D', content: 'd', isCorrect: false },
            ],
          },
          10,
        ),
      ).rejects.toThrow('Chapter does not belong to the specified subject');
    });
  });

  describe('getQuestionById', () => {
    it('should return question with full details', async () => {
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await questionService.getQuestionById(1);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
      expect(result.data.options).toHaveLength(4);
    });

    it('should throw 404 for non-existent question', async () => {
      prismaMock.question.findUnique.mockResolvedValue(null);

      await expect(questionService.getQuestionById(999)).rejects.toThrow(
        'Question not found',
      );
    });
  });

  describe('deleteQuestion', () => {
    it('should delete question not in active exams', async () => {
      prismaMock.question.findUnique.mockResolvedValue({
        ...mockQuestion,
        examQuestions: [],
      });
      prismaMock.question.delete.mockResolvedValue(mockQuestion);

      const result = await questionService.deleteQuestion(1);

      expect(result.success).toBe(true);
      expect(prismaMock.question.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw 409 if question is in active exam', async () => {
      prismaMock.question.findUnique.mockResolvedValue({
        ...mockQuestion,
        examQuestions: [
          { exam: { id: 1, title: 'Active Exam', status: 'PUBLISHED' } },
        ],
      });

      await expect(questionService.deleteQuestion(1)).rejects.toThrow(
        'Cannot delete: question is used in active exam',
      );
    });
  });

  describe('listQuestions', () => {
    it('should return paginated results', async () => {
      prismaMock.question.findMany.mockResolvedValue([mockQuestion]);
      prismaMock.question.count.mockResolvedValue(1);

      const result = await questionService.listQuestions({ page: 1, limit: 20, difficulty: undefined });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toBeDefined();
    });

    it('should filter by subject', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.question.count.mockResolvedValue(0);

      await questionService.listQuestions({ page: 1, limit: 20, difficulty: undefined, subjectId: 1 });

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ subjectId: 1 }),
        }),
      );
    });

    it('should filter by difficulty array', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.question.count.mockResolvedValue(0);

      await questionService.listQuestions({ page: 1, limit: 20, difficulty: [1, 2] });

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ difficulty: { in: [1, 2] } }),
        }),
      );
    });

    it('should filter by question type', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.question.count.mockResolvedValue(0);

      await questionService.listQuestions({
        page: 1,
        limit: 20,
        difficulty: undefined,
        questionType: 'MULTIPLE_CHOICE',
      });

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ questionType: 'MULTIPLE_CHOICE' }),
        }),
      );
    });

    it('should support keyword search', async () => {
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.question.count.mockResolvedValue(0);

      await questionService.listQuestions({ page: 1, limit: 20, difficulty: undefined, keyword: 'addition' });

      expect(prismaMock.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });

  describe('addTags', () => {
    it('should add new tags to question', async () => {
      prismaMock.question.findUnique.mockResolvedValue(mockQuestion);
      prismaMock.questionTag.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, tagName: 'algebra' }]);
      prismaMock.questionTag.createMany.mockResolvedValue({ count: 1 });

      const result = await questionService.addTags(1, { tags: ['algebra'] });

      expect(result.success).toBe(true);
    });

    it('should throw 404 for non-existent question', async () => {
      prismaMock.question.findUnique.mockResolvedValue(null);

      await expect(
        questionService.addTags(999, { tags: ['tag1'] }),
      ).rejects.toThrow('Question not found');
    });
  });

  describe('bulkCreate', () => {
    it('should use the General topic when topicId is omitted', async () => {
      prismaMock.subject.findUnique.mockResolvedValue({
        id: 1,
        name: 'Mathematics',
        code: 'MATH',
        description: '',
        status: 1,
      });
      prismaMock.chapter.findUnique.mockResolvedValue({
        id: 1,
        subjectId: 1,
        name: 'Arithmetic',
        gradeLevel: 10,
        orderIndex: 1,
      });
      prismaMock.topic.findFirst.mockResolvedValue({
        id: 9,
        chapterId: 1,
        name: 'General',
        description: '',
      });
      prismaMock.question.create.mockResolvedValue({
        ...mockQuestion,
        topicId: 9,
      });

      const result = await questionService.bulkCreate(
        [
          {
            content: 'What is 2+2?',
            questionType: 'SINGLE_CHOICE',
            difficulty: 1,
            explanation: null,
            options: [
              { label: 'A', content: '3', isCorrect: false },
              { label: 'B', content: '4', isCorrect: true },
            ],
          },
        ],
        { subjectId: 1, chapterId: 1 },
        10,
      );

      expect(result.data.imported).toBe(1);
      expect(prismaMock.topic.findFirst).toHaveBeenCalledWith({
        where: { chapterId: 1, name: 'General' },
        orderBy: { id: 'asc' },
      });
      expect(prismaMock.question.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ topicId: 9 }),
        }),
      );
    });
  });

  describe('importFromExcel (validation)', () => {
    it('should generate a valid import template buffer', () => {
      const buffer = questionService.generateImportTemplate();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
