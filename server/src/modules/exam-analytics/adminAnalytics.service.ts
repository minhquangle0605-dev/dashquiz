import { prisma } from '../../config/database';
import { cacheGet, cacheSet } from '../../utils/cache';

// School-wide analytics for administrators (PDF §5 Admin Analytics).
// Read-only aggregation across every class / subject / exam.

const COMPLETED = ['SUBMITTED', 'GRADED'] as const;
const FLAGGED = ['too_easy', 'too_hard', 'needs_review'];

const round2 = (n: number) => Math.round(n * 100) / 100;

function passOf(score: number, passing: number | null): boolean {
  return score >= (passing ?? 5);
}

export class AdminAnalyticsService {
  async getOverview() {
    const cacheKey = 'analytics:admin:overview';
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const [examCount, classCount, studentCount, flaggedQuestions, attempts] = await Promise.all([
      prisma.exam.count(),
      prisma.class.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.questionStat.count({ where: { qualityFlag: { in: FLAGGED } } }),
      prisma.examAttempt.findMany({
        where: { status: { in: [...COMPLETED] } },
        select: { totalScore: true, exam: { select: { passingScore: true } } },
      }),
    ]);

    const scores = attempts.map((a) => Number(a.totalScore ?? 0));
    const avgScore = scores.length ? round2(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
    const passedCount = attempts.filter((a) =>
      passOf(Number(a.totalScore ?? 0), a.exam.passingScore != null ? Number(a.exam.passingScore) : null),
    ).length;
    const passRate = attempts.length ? round2((passedCount / attempts.length) * 100) : 0;

    const result = {
      examCount,
      classCount,
      studentCount,
      totalAttempts: attempts.length,
      avgScore,
      passRate,
      flaggedQuestions,
    };
    await cacheSet(cacheKey, result, 300);
    return result;
  }

  async getClasses() {
    const classes = await prisma.class.findMany({
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        subject: { select: { name: true } },
        teacher: { select: { fullName: true } },
        _count: { select: { classStudents: true } },
      },
      orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
    });

    const rows = [];
    for (const cls of classes) {
      const studentIds = (
        await prisma.classStudent.findMany({ where: { classId: cls.id }, select: { studentId: true } })
      ).map((s) => s.studentId);
      const examIds = (
        await prisma.examAssignment.findMany({ where: { classId: cls.id }, select: { examId: true } })
      ).map((e) => e.examId);

      const attempts =
        studentIds.length && examIds.length
          ? await prisma.examAttempt.findMany({
              where: {
                studentId: { in: studentIds },
                examId: { in: examIds },
                status: { in: [...COMPLETED] },
              },
              select: { totalScore: true, exam: { select: { passingScore: true } } },
            })
          : [];

      const scores = attempts.map((a) => Number(a.totalScore ?? 0));
      const avgScore = scores.length ? round2(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
      const passed = attempts.filter((a) =>
        passOf(Number(a.totalScore ?? 0), a.exam.passingScore != null ? Number(a.exam.passingScore) : null),
      ).length;

      rows.push({
        classId: cls.id,
        className: cls.name,
        gradeLevel: cls.gradeLevel,
        subjectName: cls.subject.name,
        teacherName: cls.teacher.fullName,
        studentCount: cls._count.classStudents,
        attemptCount: attempts.length,
        avgScore,
        passRate: attempts.length ? round2((passed / attempts.length) * 100) : 0,
      });
    }
    return rows.sort((a, b) => b.avgScore - a.avgScore);
  }

  async getSubjects() {
    const subjects = await prisma.subject.findMany({
      where: { status: 1 },
      select: { id: true, name: true, code: true },
      orderBy: { id: 'asc' },
    });

    const rows = [];
    for (const subject of subjects) {
      const examCount = await prisma.exam.count({ where: { subjectId: subject.id } });
      const attempts = await prisma.examAttempt.findMany({
        where: { status: { in: [...COMPLETED] }, exam: { subjectId: subject.id } },
        select: { totalScore: true, exam: { select: { passingScore: true } } },
      });
      const scores = attempts.map((a) => Number(a.totalScore ?? 0));
      const avgScore = scores.length ? round2(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
      const passed = attempts.filter((a) =>
        passOf(Number(a.totalScore ?? 0), a.exam.passingScore != null ? Number(a.exam.passingScore) : null),
      ).length;

      rows.push({
        subjectId: subject.id,
        subjectName: subject.name,
        subjectCode: subject.code,
        examCount,
        attemptCount: attempts.length,
        avgScore,
        passRate: attempts.length ? round2((passed / attempts.length) * 100) : 0,
      });
    }
    return rows;
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
