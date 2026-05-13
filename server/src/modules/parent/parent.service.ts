import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { studentAnalyticsService } from '../analytics/analytics.service';
import type { ChildResultsQuery } from './parent.validation';

/**
 * Dual-login parent module.
 *
 * After the schema refactor there is no separate parent record: a parent logs in
 * with the student's username + the parent password stored on the student row.
 * The auth service emits a JWT with role='parent' and studentId=<student id>,
 * so every endpoint here operates on that one student — no link table, no
 * cross-student access. Routes pull the id from req.user.studentId (or .id,
 * which is the same in dual-login) and pass it in.
 */
export class ParentService {
  private async loadChild(studentId: number) {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatar: true,
        status: true,
        lastLoginAt: true,
        role: true,
        enrolledClasses: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                gradeLevel: true,
                subject: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!student || student.role !== 'STUDENT') {
      throw new AppError('Student record not found', 404);
    }

    return student;
  }

  /**
   * The dual-login parent always has exactly one "child" — the underlying
   * student account. Returned as a single-item list to keep the frontend
   * contract stable.
   */
  async getChildren(studentId: number) {
    const student = await this.loadChild(studentId);

    return [
      {
        student: {
          id: student.id,
          username: student.username,
          fullName: student.fullName,
          avatar: student.avatar,
          status: student.status,
          lastLoginAt: student.lastLoginAt,
          classes: student.enrolledClasses.map((cs) => ({
            id: cs.class.id,
            name: cs.class.name,
            gradeLevel: cs.class.gradeLevel,
            subjectName: cs.class.subject.name,
          })),
        },
      },
    ];
  }

  private assertOwnChild(sessionStudentId: number, requestedChildId: number): void {
    if (sessionStudentId !== requestedChildId) {
      throw new AppError('This student is not linked to your account', 403);
    }
  }

  async getChildResults(sessionStudentId: number, childId: number, query: ChildResultsQuery) {
    this.assertOwnChild(sessionStudentId, childId);
    return studentAnalyticsService.getAttempts(childId, {
      page: query.page,
      limit: query.limit,
      subjectId: query.subjectId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      sort: query.sort,
      order: query.order,
    });
  }

  async getChildDashboard(sessionStudentId: number, childId: number, subjectId?: number) {
    this.assertOwnChild(sessionStudentId, childId);
    return studentAnalyticsService.getDashboard(childId, subjectId);
  }

  async getChildStrengths(sessionStudentId: number, childId: number, subjectId?: number) {
    this.assertOwnChild(sessionStudentId, childId);
    return studentAnalyticsService.getStrengths(childId, subjectId);
  }
}

export const parentService = new ParentService();
