import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { studentAnalyticsService } from '../analytics/analytics.service';
import { knowledgeGraphService } from '../knowledge-graph/knowledgeGraph.service';
import type { ChildResultsQuery } from './parent.validation';

export class ParentService {
  private async loadParent(parentUserId: number) {
    const parent = await prisma.parentProfile.findUnique({
      where: { userId: parentUserId },
      include: {
        children: {
          include: {
            user: {
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
        },
      },
    });

    if (!parent) {
      throw new AppError('Parent profile not found', 404);
    }

    return parent;
  }

  async getChildren(parentUserId: number) {
    const parent = await this.loadParent(parentUserId);

    return parent.children.map((child) => ({
      student: {
        id: child.user.id,
        username: child.user.username,
        fullName: child.user.fullName ?? child.fullName,
        avatar: child.user.avatar,
        status: child.user.status,
        lastLoginAt: child.user.lastLoginAt,
        classes: child.user.enrolledClasses.map((cs) => ({
          id: cs.class.id,
          name: cs.class.name,
          gradeLevel: cs.class.gradeLevel,
          subjectName: cs.class.subject.name,
        })),
      },
    }));
  }

  private async assertOwnChild(parentUserId: number, requestedChildUserId: number): Promise<void> {
    const child = await prisma.studentProfile.findFirst({
      where: {
        userId: requestedChildUserId,
        parent: { userId: parentUserId },
      },
      select: { userId: true },
    });

    if (!child) {
      throw new AppError('This student is not linked to your account', 403);
    }
  }

  async getChildResults(parentUserId: number, childId: number, query: ChildResultsQuery) {
    await this.assertOwnChild(parentUserId, childId);
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

  async getChildDashboard(parentUserId: number, childId: number, subjectId?: number) {
    await this.assertOwnChild(parentUserId, childId);
    return studentAnalyticsService.getDashboard(childId, subjectId);
  }

  /** Read-only view of a linked child's knowledge graph (mastery by subject/chapter/skill). */
  async getChildKnowledgeGraph(parentUserId: number, childId: number, subjectId?: number) {
    await this.assertOwnChild(parentUserId, childId);
    return knowledgeGraphService.getStudentGraph(childId, subjectId);
  }

  /** Prerequisite learning path to a node, annotated with the child's mastery. */
  async getChildLearningPath(parentUserId: number, childId: number, targetNodeId: number) {
    await this.assertOwnChild(parentUserId, childId);
    return knowledgeGraphService.getLearningPath(childId, targetNodeId);
  }
}

export const parentService = new ParentService();
