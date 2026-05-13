import crypto from 'crypto';
import { prisma } from '../../config/database';
import { getRedisClient } from '../../config/redis';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { studentAnalyticsService } from '../analytics/analytics.service';
import type { LinkStudentInput, ChildResultsQuery, ChildAnalyticsQuery } from './parent.validation';

const LINK_CODE_PREFIX = 'student_link_code:';
const LINK_CODE_TTL = 24 * 60 * 60; // 24 hours

export class ParentService {
  /**
   * Generate a 6-char random link code for a student (admin action).
   * Stored in Redis with 24h TTL.
   */
  async generateLinkCode(studentId: number): Promise<{ code: string; expiresIn: string }> {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: { role: true },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    if (student.role.name !== 'Student') {
      throw new AppError('User is not a student', 400);
    }

    const code = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);

    const redis = getRedisClient();
    await redis.set(`${LINK_CODE_PREFIX}${code}`, studentId.toString(), 'EX', LINK_CODE_TTL);

    logger.info(`Link code generated for student ${studentId}: ${code}`);

    return {
      code,
      expiresIn: '24 hours',
    };
  }

  /**
   * UC18 – Parent enters link code to connect with child student account.
   */
  async linkStudent(parentId: number, data: LinkStudentInput) {
    const redis = getRedisClient();
    const key = `${LINK_CODE_PREFIX}${data.code}`;
    const studentIdStr = await redis.get(key);

    if (!studentIdStr) {
      throw new AppError('Invalid or expired link code', 400);
    }

    const studentId = parseInt(studentIdStr, 10);

    const existingLink = await prisma.parentStudent.findFirst({
      where: { parentId, studentId },
    });

    if (existingLink) {
      await redis.del(key);
      throw new AppError('This student is already linked to your account', 409);
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, username: true },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    const link = await prisma.parentStudent.create({
      data: {
        parentId,
        studentId,
        relationship: data.relationship || 'parent',
      },
    });

    await redis.del(key);

    return {
      id: link.id,
      studentId: student.id,
      studentName: student.fullName || student.username,
      studentUsername: student.username,
      relationship: link.relationship,
      linkedAt: link.linkedAt,
    };
  }

  /**
   * Get all linked children for a parent.
   */
  async getChildren(parentId: number) {
    const links = await prisma.parentStudent.findMany({
      where: { parentId },
      include: {
        student: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            status: true,
            lastLoginAt: true,
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
        },
      },
      orderBy: { linkedAt: 'desc' },
    });

    return links.map((link) => ({
      linkId: link.id,
      relationship: link.relationship,
      linkedAt: link.linkedAt,
      student: {
        id: link.student.id,
        username: link.student.username,
        fullName: link.student.fullName,
        avatar: link.student.avatar,
        status: link.student.status,
        lastLoginAt: link.student.lastLoginAt,
        classes: link.student.enrolledClasses.map((cs) => ({
          id: cs.class.id,
          name: cs.class.name,
          gradeLevel: cs.class.gradeLevel,
          subjectName: cs.class.subject.name,
        })),
      },
    }));
  }

  /**
   * Verify parent-child relationship before accessing child data.
   */
  private async verifyParentChildLink(parentId: number, childId: number): Promise<void> {
    const link = await prisma.parentStudent.findFirst({
      where: { parentId, studentId: childId },
    });

    if (!link) {
      throw new AppError('This student is not linked to your account', 403);
    }
  }

  /**
   * UC19 – Get child's exam results (paginated).
   * Reuses StudentAnalyticsService.getAttempts with child's ID.
   */
  async getChildResults(parentId: number, childId: number, query: ChildResultsQuery) {
    await this.verifyParentChildLink(parentId, childId);

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

  /**
   * UC20 – Get child's dashboard (reuse student analytics).
   */
  async getChildDashboard(parentId: number, childId: number, subjectId?: number) {
    await this.verifyParentChildLink(parentId, childId);

    return studentAnalyticsService.getDashboard(childId, subjectId);
  }

  /**
   * UC21 – Get child's strengths/weaknesses analysis.
   */
  async getChildStrengths(parentId: number, childId: number, subjectId?: number) {
    await this.verifyParentChildLink(parentId, childId);

    return studentAnalyticsService.getStrengths(childId, subjectId);
  }
}

export const parentService = new ParentService();
