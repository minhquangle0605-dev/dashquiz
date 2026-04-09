import '../../mocks/redis';
import '../../mocks/prisma';

import { prismaMock } from '../../mocks/prisma';

jest.mock('../../../utils/cache', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheInvalidate: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../config/minio', () => ({
  getMinioClient: jest.fn().mockReturnValue({
    putObject: jest.fn().mockResolvedValue({}),
    presignedGetObject: jest.fn().mockResolvedValue('https://minio/test'),
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn().mockResolvedValue(undefined),
  }),
}));

import { StudentAnalyticsService } from '../../../modules/analytics/analytics.service';

const studentAnalytics = new StudentAnalyticsService();

afterEach(() => {
  jest.clearAllMocks();
});

describe('StudentAnalyticsService', () => {
  describe('getDashboard', () => {
    it('should return dashboard with correct score aggregation', async () => {
      prismaMock.examAttempt.count.mockResolvedValue(3);
      prismaMock.examAttempt.aggregate.mockResolvedValue({
        _avg: { totalScore: 7.5 },
        _max: { totalScore: 9.0 },
        _min: { totalScore: 6.0 },
      });
      prismaMock.examAttempt.findMany.mockResolvedValue([
        {
          id: 1,
          totalScore: 8.0,
          submittedAt: new Date(),
          timeSpentSec: 1800,
          exam: { id: 1, title: 'Exam 1', subject: { name: 'Math' } },
        },
      ]);

      (prismaMock.examAttempt as any).groupBy = jest.fn().mockResolvedValue([]);

      const result = await studentAnalytics.getDashboard(1) as any;

      expect(result).toBeDefined();
      expect(result.totalExams).toBe(3);
      expect(result.avgScore).toBe(7.5);
      expect(result.maxScore).toBe(9.0);
      expect(result.minScore).toBe(6.0);
    });

    it('should handle student with no exam attempts', async () => {
      prismaMock.examAttempt.count.mockResolvedValue(0);
      prismaMock.examAttempt.aggregate.mockResolvedValue({
        _avg: { totalScore: null },
        _max: { totalScore: null },
        _min: { totalScore: null },
      });
      prismaMock.examAttempt.findMany.mockResolvedValue([]);
      (prismaMock.examAttempt as any).groupBy = jest.fn().mockResolvedValue([]);

      const result = await studentAnalytics.getDashboard(1) as any;

      expect(result.totalExams).toBe(0);
      expect(result.avgScore).toBe(0);
    });

    it('should filter by subjectId when provided', async () => {
      prismaMock.examAttempt.count.mockResolvedValue(0);
      prismaMock.examAttempt.aggregate.mockResolvedValue({
        _avg: { totalScore: null },
        _max: { totalScore: null },
        _min: { totalScore: null },
      });
      prismaMock.examAttempt.findMany.mockResolvedValue([]);
      (prismaMock.examAttempt as any).groupBy = jest.fn().mockResolvedValue([]);

      await studentAnalytics.getDashboard(1, 2);

      expect(prismaMock.examAttempt.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          studentId: 1,
          status: 'SUBMITTED',
          exam: { subjectId: 2 },
        }),
      });
    });
  });
});
