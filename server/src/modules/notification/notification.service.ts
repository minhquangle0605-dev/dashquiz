import webpush from 'web-push';

import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { cacheGet, cacheSet, cacheInvalidateExact } from '../../utils/cache';
import { AppError } from '../../middlewares/errorHandler';
import { emitNotification, emitDashboardUpdate } from '../../socket';
import type { ListNotificationsQuery, PushSubscribeInput } from './notification.validation';

// ═══════════════════════════════════════════════════
// VAPID SETUP
// ═══════════════════════════════════════════════════

if (env.vapid.publicKey && env.vapid.privateKey) {
  try {
    webpush.setVapidDetails(
      env.vapid.contact || 'mailto:admin@webquiz.local',
      env.vapid.publicKey,
      env.vapid.privateKey,
    );
    logger.info('VAPID keys configured for web push');
  } catch (err) {
    logger.warn('Failed to set VAPID details — web push disabled:', err);
  }
}

// ═══════════════════════════════════════════════════
// NOTIFICATION SERVICE
// ═══════════════════════════════════════════════════

const UNREAD_COUNT_CACHE_TTL = 60;

export class NotificationService {
  private unreadCountCacheKey(userId: number): string {
    return `notification:unread:${userId}`;
  }

  private async invalidateUnreadCount(userId: number): Promise<void> {
    await cacheInvalidateExact(this.unreadCountCacheKey(userId));
  }

  /**
   * GET /api/notifications — paginated, filterable by is_read.
   */
  async listNotifications(userId: number, query: ListNotificationsQuery) {
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const where: { userId: number; isRead?: boolean } = { userId };

    if (query.isRead === 'true') where.isRead = true;
    else if (query.isRead === 'false') where.isRead = false;

    const uKey = this.unreadCountCacheKey(userId);
    const cachedUnread = await cacheGet<number>(uKey);
    const unreadPromise =
      cachedUnread !== null
        ? Promise.resolve(cachedUnread)
        : prisma.notification.count({ where: { userId, isRead: false } }).then(async (count) => {
            await cacheSet(uKey, count, UNREAD_COUNT_CACHE_TTL);
            return count;
          });

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      unreadPromise,
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * PUT /api/notifications/:id/read — mark single as read.
   */
  async markAsRead(userId: number, notificationId: number) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    await this.invalidateUnreadCount(userId);

    return { id: notificationId, isRead: true };
  }

  /**
   * PUT /api/notifications/read-all — mark all as read for user.
   */
  async markAllAsRead(userId: number) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    await this.invalidateUnreadCount(userId);

    return { updatedCount: result.count };
  }

  /**
   * Create an in-app notification record and push it via Socket.IO.
   */
  async createNotification(userId: number, title: string, message: string, type: string) {
    const notification = await prisma.notification.create({
      data: { userId, title, message, type, isRead: false },
    });

    await this.invalidateUnreadCount(userId);

    emitNotification(userId, {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.createdAt,
    });

    return notification;
  }

  /**
   * Send web push to all subscribed devices of a user.
   */
  async sendWebPush(userId: number, payload: { title: string; body: string; url?: string }): Promise<number> {
    if (!env.vapid.publicKey || !env.vapid.privateKey) {
      logger.warn('VAPID not configured — skipping web push');
      return 0;
    }

    const subscriptions = await prisma.webPushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return 0;

    let sentCount = 0;
    const staleIds: number[] = [];

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dhKey,
          auth: sub.authKey,
        },
      };

      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            url: payload.url || '/',
            timestamp: Date.now(),
          }),
        );
        sentCount++;
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          staleIds.push(sub.id);
        } else {
          logger.warn(`Web push failed for subscription ${sub.id}:`, error);
        }
      }
    }

    if (staleIds.length > 0) {
      await prisma.webPushSubscription.deleteMany({
        where: { id: { in: staleIds } },
      });
      logger.info(`Cleaned up ${staleIds.length} stale push subscriptions`);
    }

    return sentCount;
  }

  /**
   * POST /api/push/subscribe — save browser push subscription.
   */
  async subscribePush(userId: number, data: PushSubscribeInput) {
    const existing = await prisma.webPushSubscription.findFirst({
      where: { userId, endpoint: data.endpoint },
    });

    if (existing) {
      await prisma.webPushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dhKey: data.keys.p256dh,
          authKey: data.keys.auth,
        },
      });
      return { id: existing.id, updated: true };
    }

    const sub = await prisma.webPushSubscription.create({
      data: {
        userId,
        endpoint: data.endpoint,
        p256dhKey: data.keys.p256dh,
        authKey: data.keys.auth,
      },
    });

    return { id: sub.id, updated: false };
  }

  /**
   * DELETE /api/push/unsubscribe — remove push subscription.
   */
  async unsubscribePush(userId: number, endpoint: string) {
    const result = await prisma.webPushSubscription.deleteMany({
      where: { userId, endpoint },
    });

    return { removed: result.count > 0 };
  }

  // ═══════════════════════════════════════════════════
  // NOTIFICATION TRIGGERS
  // Called from other services when events happen.
  // ═══════════════════════════════════════════════════

  /**
   * Trigger: Student submitted exam.
   *
   * Dual-login: the parent shares the student's user record, so the student's
   * notification feed is what the parent sees on login. We only push a separate
   * web-push when the student row has a parentPasswordHash (a parent is
   * actually configured) so the device gets a parent-framed message.
   */
  async onExamSubmitted(studentId: number, examTitle: string, score: number, totalQuestions: number, correctCount: number) {
    try {
      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: {
          fullName: true,
          username: true,
          studentProfile: {
            select: {
              parent: { select: { userId: true } },
            },
          },
        },
      });
      if (!student) return;

      const studentName = student.fullName || student.username || 'Student';

      const parentUserId = student.studentProfile?.parent?.userId;

      if (parentUserId) {
        const title = `Exam Result: ${examTitle}`;
        const message = `Your child ${studentName} has finished the exam "${examTitle}", score: ${score}/10 (${correctCount}/${totalQuestions} correct).`;

        await this.createNotification(parentUserId, title, message, 'child_exam_submitted');

        emitDashboardUpdate(parentUserId, {
          reason: 'child_exam_submitted',
          entityType: 'exam_attempt',
        });

        this.sendWebPush(parentUserId, {
          title,
          body: message,
          url: `/parent/children/${studentId}/results`,
        }).catch(() => {});
      }
    } catch (error) {
      logger.error('onExamSubmitted notification trigger failed:', error);
    }
  }

  /**
   * Trigger: Teacher publishes exam results → notify students + parents.
   */
  async onResultsPublished(examId: number, examTitle: string) {
    try {
      const assignments = await prisma.examAssignment.findMany({
        where: { examId },
        select: { classId: true },
      });
      const classIds = assignments.map((a) => a.classId);

      const classStudents = await prisma.classStudent.findMany({
        where: { classId: { in: classIds } },
        include: {
          student: {
            select: { id: true, fullName: true, username: true },
          },
        },
      });

      const studentIds = new Set<number>();

      for (const cs of classStudents) {
        if (studentIds.has(cs.student.id)) continue;
        studentIds.add(cs.student.id);

        const studentName = cs.student.fullName || cs.student.username || 'Student';
        const title = `Results published: ${examTitle}`;
        const message = `The teacher has published the results for the exam "${examTitle}". View your result now!`;

        await this.createNotification(cs.student.id, title, message, 'results_published');

        this.sendWebPush(cs.student.id, {
          title,
          body: message,
          url: `/student/exams`,
        }).catch(() => {});
      }

      // Dual-login: the parent reads the student's notification feed, so the
      // 'results_published' notification we just created is already visible to
      // the parent. We don't insert duplicate parent rows; just send an extra
      // web-push framed for the parent device when one is configured.
      if (studentIds.size > 0) {
        const studentsWithParent = await prisma.studentProfile.findMany({
          where: {
            userId: { in: Array.from(studentIds) },
            parentCode: { not: null },
          },
          select: {
            userId: true,
            parent: { select: { userId: true } },
          },
        });

        for (const { userId: studentId, parent } of studentsWithParent) {
          if (!parent) continue;
          const title = `Exam results published: ${examTitle}`;
          const message = `The teacher has published the results for the exam "${examTitle}" for your child.`;

          await this.createNotification(parent.userId, title, message, 'child_results_published');

          this.sendWebPush(parent.userId, {
            title,
            body: message,
            url: `/parent/children/${studentId}/results`,
          }).catch(() => {});
        }
      }
    } catch (error) {
      logger.error('onResultsPublished notification trigger failed:', error);
    }
  }

  /**
   * Trigger: Teacher publishes (opens) an exam → notify assigned students.
   * Different from onResultsPublished which is about releasing scores.
   */
  async onExamPublished(examId: number, examTitle: string) {
    try {
      const assignments = await prisma.examAssignment.findMany({
        where: { examId },
        select: { classId: true },
      });
      const classIds = assignments.map((a) => a.classId);
      if (classIds.length === 0) return;

      const classStudents = await prisma.classStudent.findMany({
        where: { classId: { in: classIds } },
        include: {
          student: {
            select: { id: true, fullName: true, username: true },
          },
        },
      });

      const notified = new Set<number>();

      for (const cs of classStudents) {
        if (notified.has(cs.student.id)) continue;
        notified.add(cs.student.id);

        const title = `Exam opened: ${examTitle}`;
        const message = `The exam "${examTitle}" has been opened. You can start now!`;

        await this.createNotification(cs.student.id, title, message, 'exam_published');

        this.sendWebPush(cs.student.id, {
          title,
          body: message,
          url: '/student/exams',
        }).catch(() => {});
      }
    } catch (error) {
      logger.error('onExamPublished notification trigger failed:', error);
    }
  }

  /**
   * Trigger: Teacher (or admin) posts a new ANNOUNCEMENT discussion → notify students.
   * - CLASS scope: notify every enrolled student of that class.
   * - GLOBAL scope: notify every active STUDENT user.
   * The author is excluded from the recipient list.
   */
  async onAnnouncementCreated(discussionId: number) {
    try {
      const discussion = await prisma.discussion.findUnique({
        where: { id: discussionId },
        include: {
          author: { select: { id: true, fullName: true, username: true } },
          class: { select: { name: true } },
        },
      });

      if (!discussion || discussion.type !== 'ANNOUNCEMENT') return;

      let studentIds: number[] = [];

      if (discussion.scope === 'CLASS' && discussion.classId !== null) {
        const classStudents = await prisma.classStudent.findMany({
          where: { classId: discussion.classId },
          select: { studentId: true },
        });
        studentIds = classStudents.map((cs) => cs.studentId);
      } else if (discussion.scope === 'GLOBAL') {
        const students = await prisma.user.findMany({
          where: { role: 'STUDENT', status: 'ACTIVE' },
          select: { id: true },
        });
        studentIds = students.map((s) => s.id);
      }

      studentIds = studentIds.filter((id) => id !== discussion.author.id);
      if (studentIds.length === 0) return;

      const teacherName = discussion.author.fullName || discussion.author.username || 'Teacher';
      const className = discussion.class?.name;
      const title = `New announcement: ${discussion.title}`;
      const message = className
        ? `${teacherName} posted an announcement in class ${className}.`
        : `${teacherName} posted a new announcement.`;

      for (const sid of studentIds) {
        await this.createNotification(sid, title, message, 'teacher_announcement');

        this.sendWebPush(sid, {
          title,
          body: message,
          url: '/student/discussions',
        }).catch(() => {});
      }
    } catch (error) {
      logger.error('onAnnouncementCreated notification trigger failed:', error);
    }
  }

  /**
   * Trigger: Teacher assigns new exam to class → notify students.
   */
  async onExamAssigned(examId: number, classIds: number[]) {
    try {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
          subject: { select: { name: true } },
          creator: { select: { fullName: true, username: true } },
        },
      });

      if (!exam) return;

      const classStudents = await prisma.classStudent.findMany({
        where: { classId: { in: classIds } },
        include: {
          student: {
            select: { id: true, fullName: true, username: true },
          },
        },
      });

      const teacherName = exam.creator.fullName || exam.creator.username || 'Teacher';
      const notified = new Set<number>();

      for (const cs of classStudents) {
        if (notified.has(cs.student.id)) continue;
        notified.add(cs.student.id);

        const title = `New exam: ${exam.title}`;
        const message = `Teacher ${teacherName} has assigned the exam "${exam.title}" (${exam.subject.name}, ${exam.durationMin} minutes).`;

        await this.createNotification(cs.student.id, title, message, 'new_exam');

        this.sendWebPush(cs.student.id, {
          title,
          body: message,
          url: '/student/exams',
        }).catch(() => {});
      }
    } catch (error) {
      logger.error('onExamAssigned notification trigger failed:', error);
    }
  }
}

export const notificationService = new NotificationService();
