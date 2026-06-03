import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { getMinioClient } from '../../config/minio';
import { AppError } from '../../middlewares/errorHandler';
import { FILE_UPLOAD } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { notificationService } from '../notification/notification.service';
import type {
  ListDiscussionsQuery,
  CreateDiscussionInput,
  UpdateDiscussionInput,
  CreateReplyInput,
  UpdateReplyInput,
} from './discussion.validation';

const REPLY_EDIT_WINDOW_MS = 15 * 60 * 1000;
const DISCUSSION_ATTACHMENT_PREFIX = 'discussion-attachments';

type AttachmentLink = NonNullable<CreateDiscussionInput['links']>[number];

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 180) || 'file';
}

function classifyAttachment(file: Express.Multer.File): 'IMAGE' | 'VIDEO' | 'FILE' {
  if (file.mimetype.startsWith('image/')) return 'IMAGE';
  if (file.mimetype.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}

function assertFileAllowed(file: Express.Multer.File): void {
  const type = classifyAttachment(file);
  if (type === 'IMAGE') {
    const allowedImageTypes: readonly string[] = FILE_UPLOAD.ALLOWED_CLASS_IMAGE_TYPES;
    if (!allowedImageTypes.includes(file.mimetype)) {
      throw new AppError('Only JPG, PNG, WebP, and GIF images are allowed', 400);
    }
  }
  if (file.size > FILE_UPLOAD.MAX_DISCUSSION_ATTACHMENT_SIZE) {
    throw new AppError('Discussion attachments must be 100MB or smaller', 400);
  }
}

function normalizeRole(role: string): 'admin' | 'teacher' | 'student' | 'parent' {
  return role.toLowerCase() as 'admin' | 'teacher' | 'student' | 'parent';
}

class DiscussionService {
  // ─────────────────────────────────────────────────────────────
  // Access helpers
  // ─────────────────────────────────────────────────────────────
  private async getClassAccess(classId: number, userId: number, role: string) {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        memberRoles: { where: { userId }, select: { role: true } },
        classStudents: { where: { studentId: userId }, select: { studentId: true } },
      },
    });
    if (!cls) throw new AppError('Class not found', 404);
    const r = normalizeRole(role);
    const isAdmin = r === 'admin';
    const isOwner = r === 'teacher' && cls.teacherId === userId;
    const assigned = cls.memberRoles[0]?.role ?? null;
    const isEnrolled = r === 'student' && cls.classStudents.length > 0;
    const isStaff =
      assigned === 'TEACHER' || assigned === 'TA' || assigned === 'NON_EDITING_TEACHER';
    if (!isAdmin && !isOwner && !isStaff && !isEnrolled) {
      throw new AppError('You do not have permission to access this class', 403);
    }
    return {
      isAdmin,
      isOwner,
      isEnrolled,
      isStaff,
      canPost: isAdmin || isOwner || isStaff || isEnrolled,
      canModerate: isAdmin || isOwner || assigned === 'TEACHER',
      canAnnounce: isAdmin || isOwner || assigned === 'TEACHER',
    };
  }

  private async resolveScopeForList(
    userId: number,
    role: string,
    classIdFilter?: number,
  ): Promise<{ allowedClassIds: number[]; isAdmin: boolean }> {
    const r = normalizeRole(role);
    if (r === 'admin') {
      return { allowedClassIds: [], isAdmin: true };
    }
    // Build list of class ids the user can see
    const memberClasses = await prisma.classMemberRoleAssignment.findMany({
      where: { userId },
      select: { classId: true },
    });
    const taughtClasses =
      r === 'teacher'
        ? await prisma.class.findMany({ where: { teacherId: userId }, select: { id: true } })
        : [];
    const enrolled =
      r === 'student'
        ? await prisma.classStudent.findMany({ where: { studentId: userId }, select: { classId: true } })
        : [];
    const ids = new Set<number>([
      ...memberClasses.map((m) => m.classId),
      ...taughtClasses.map((c) => c.id),
      ...enrolled.map((e) => e.classId),
    ]);
    if (classIdFilter !== undefined && !ids.has(classIdFilter)) {
      throw new AppError('You do not have permission to access this class', 403);
    }
    return { allowedClassIds: Array.from(ids), isAdmin: false };
  }

  // ─────────────────────────────────────────────────────────────
  // List
  // ─────────────────────────────────────────────────────────────
  async listDiscussions(query: ListDiscussionsQuery, userId: number, role: string) {
    const { allowedClassIds, isAdmin } = await this.resolveScopeForList(userId, role, query.classId);

    const where: Prisma.DiscussionWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.authorId) where.authorId = query.authorId;

    if (isAdmin) {
      if (query.scope) where.scope = query.scope;
      if (query.classId !== undefined) where.classId = query.classId;
    } else {
      // Restrict to: GLOBAL OR CLASS in allowedClassIds
      if (query.scope === 'GLOBAL') {
        where.scope = 'GLOBAL';
      } else if (query.scope === 'CLASS') {
        where.scope = 'CLASS';
        where.classId =
          query.classId !== undefined ? query.classId : { in: allowedClassIds };
      } else {
        where.OR = [
          ...(where.OR ?? []),
          { scope: 'GLOBAL' },
          { scope: 'CLASS', classId: { in: allowedClassIds } },
        ];
      }
    }

    const total = await prisma.discussion.count({ where });
    const data = await prisma.discussion.findMany({
      where,
      include: {
        author: { select: { id: true, fullName: true, username: true, role: true, avatar: true } },
        class: { select: { id: true, name: true, gradeLevel: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
        _count: { select: { replies: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Get one (with replies)
  // ─────────────────────────────────────────────────────────────
  async getDiscussion(id: number, userId: number, role: string) {
    const discussion = await prisma.discussion.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, fullName: true, username: true, role: true, avatar: true } },
        class: { select: { id: true, name: true, gradeLevel: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, fullName: true, username: true, role: true, avatar: true },
            },
            attachments: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!discussion) throw new AppError('Discussion not found', 404);

    const r = normalizeRole(role);
    if (r !== 'admin') {
      if (discussion.scope === 'CLASS' && discussion.classId !== null) {
        await this.getClassAccess(discussion.classId, userId, role);
      }
    }
    return discussion;
  }

  // ─────────────────────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────────────────────
  private async createAttachmentRows(
    discussionId: number,
    userId: number,
    links: AttachmentLink[] = [],
    files: Express.Multer.File[] = [],
    replyId?: number,
  ) {
    const rows: Prisma.DiscussionAttachmentCreateManyInput[] = links.map((link) => ({
      discussionId,
      replyId: replyId ?? null,
      uploaderId: userId,
      type: 'LINK',
      url: link.url,
      title: link.title?.trim() || link.url,
    }));

    for (const file of files) {
      assertFileAllowed(file);
      const objectName = `${DISCUSSION_ATTACHMENT_PREFIX}/${userId}/${Date.now()}-${randomUUID()}-${sanitizeFilename(file.originalname)}`;
      await getMinioClient().putObject(env.minio.bucket, objectName, file.buffer, file.size, {
        'Content-Type': file.mimetype,
      });
      rows.push({
        discussionId,
        replyId: replyId ?? null,
        uploaderId: userId,
        type: classifyAttachment(file),
        url: objectName,
        title: file.originalname,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
      });
    }

    if (rows.length > 0) {
      await prisma.discussionAttachment.createMany({ data: rows });
    }
  }

  private async removeStoredAttachments(attachments: { type: string; url: string }[]) {
    for (const attachment of attachments) {
      if (attachment.type === 'LINK') continue;
      try {
        await getMinioClient().removeObject(env.minio.bucket, attachment.url);
      } catch (error) {
        logger.warn('Failed to remove discussion attachment object', {
          objectName: attachment.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  async createDiscussion(
    input: CreateDiscussionInput,
    userId: number,
    role: string,
    files: Express.Multer.File[] = [],
  ) {
    const r = normalizeRole(role);
    const content = input.content.trim();
    const links = input.links ?? [];
    if (!content && links.length === 0 && files.length === 0) {
      throw new AppError('Content, link, or attachment is required', 400);
    }
    files.forEach(assertFileAllowed);

    if (input.scope === 'GLOBAL') {
      // Only ADMIN may post to GLOBAL announcements; teachers may post GLOBAL discussions
      if (input.type === 'ANNOUNCEMENT' && r !== 'admin') {
        throw new AppError('Only admins can create school-wide announcements', 403);
      }
      if (r === 'student') {
        throw new AppError('Students cannot create school-wide posts', 403);
      }
    } else {
      // CLASS scope
      if (input.classId === undefined) throw new AppError('Missing classId', 400);
      const access = await this.getClassAccess(input.classId, userId, role);
      if (input.type === 'ANNOUNCEMENT' && !access.canAnnounce) {
        throw new AppError('Only teachers or admins can create class announcements', 403);
      }
      if (!access.canPost) {
        throw new AppError('You are not allowed to post in this class', 403);
      }
    }

    const discussion = await prisma.discussion.create({
      data: {
        scope: input.scope,
        type: input.type,
        classId: input.scope === 'CLASS' ? input.classId! : null,
        authorId: userId,
        title: input.title,
        content,
      },
    });
    await this.createAttachmentRows(discussion.id, userId, links, files);

    const created = await prisma.discussion.findUniqueOrThrow({
      where: { id: discussion.id },
      include: {
        author: { select: { id: true, fullName: true, username: true, role: true, avatar: true } },
        class: { select: { id: true, name: true, gradeLevel: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
        _count: { select: { replies: true } },
      },
    });

    if (created.type === 'ANNOUNCEMENT') {
      notificationService.onAnnouncementCreated(created.id).catch(() => {});
    }

    return created;
  }

  // ─────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────
  async updateDiscussion(id: number, input: UpdateDiscussionInput, userId: number, role: string) {
    const discussion = await prisma.discussion.findUnique({ where: { id } });
    if (!discussion) throw new AppError('Discussion not found', 404);
    const r = normalizeRole(role);
    const isAdmin = r === 'admin';
    const isAuthor = discussion.authorId === userId;

    const wantsModerate =
      input.isPinned !== undefined || input.isLocked !== undefined || input.type !== undefined;

    if (wantsModerate) {
      if (isAdmin) {
        // ok
      } else if (discussion.scope === 'CLASS' && discussion.classId !== null) {
        const access = await this.getClassAccess(discussion.classId, userId, role);
        if (!access.canModerate) {
          throw new AppError('You do not have permission to moderate this discussion', 403);
        }
      } else {
        throw new AppError('Only admins can moderate school-wide discussions', 403);
      }
    }

    if ((input.title !== undefined || input.content !== undefined) && !isAuthor && !isAdmin) {
      throw new AppError('Only the author or admin can edit the content', 403);
    }

    return prisma.discussion.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
        ...(input.isLocked !== undefined ? { isLocked: input.isLocked } : {}),
      },
      include: {
        author: { select: { id: true, fullName: true, username: true, role: true, avatar: true } },
        class: { select: { id: true, name: true, gradeLevel: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
        _count: { select: { replies: true } },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────────────────────
  async deleteDiscussion(id: number, userId: number, role: string) {
    const discussion = await prisma.discussion.findUnique({ where: { id } });
    if (!discussion) throw new AppError('Discussion not found', 404);
    const r = normalizeRole(role);
    const isAdmin = r === 'admin';
    const isAuthor = discussion.authorId === userId;
    let canModerate = false;
    if (discussion.scope === 'CLASS' && discussion.classId !== null) {
      try {
        const access = await this.getClassAccess(discussion.classId, userId, role);
        canModerate = access.canModerate;
      } catch {
        canModerate = false;
      }
    }
    if (!isAdmin && !isAuthor && !canModerate) {
      throw new AppError('You do not have permission to delete this discussion', 403);
    }
    const attachments = await prisma.discussionAttachment.findMany({
      where: { discussionId: id },
      select: { type: true, url: true },
    });
    await prisma.discussion.delete({ where: { id } });
    await this.removeStoredAttachments(attachments);
    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────────────
  // Reply: list/create/update/delete
  // ─────────────────────────────────────────────────────────────
  async createReply(
    discussionId: number,
    input: CreateReplyInput,
    userId: number,
    role: string,
    files: Express.Multer.File[] = [],
  ) {
    const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
    if (!discussion) throw new AppError('Discussion not found', 404);
    if (discussion.isLocked) throw new AppError('This discussion is locked and cannot be replied to', 403);
    const content = input.content.trim();
    const links = input.links ?? [];
    if (!content && links.length === 0 && files.length === 0) {
      throw new AppError('Content, link, or attachment is required', 400);
    }
    files.forEach(assertFileAllowed);

    const r = normalizeRole(role);
    if (discussion.scope === 'CLASS' && discussion.classId !== null && r !== 'admin') {
      const access = await this.getClassAccess(discussion.classId, userId, role);
      if (!access.canPost) throw new AppError('You are not allowed to reply in this class', 403);
    }

    const reply = await prisma.discussionReply.create({
      data: {
        discussionId,
        authorId: userId,
        content,
      },
    });
    await this.createAttachmentRows(discussionId, userId, links, files, reply.id);
    return prisma.discussionReply.findUniqueOrThrow({
      where: { id: reply.id },
      include: {
        author: { select: { id: true, fullName: true, username: true, role: true, avatar: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async updateReply(replyId: number, input: UpdateReplyInput, userId: number, role: string) {
    const reply = await prisma.discussionReply.findUnique({ where: { id: replyId } });
    if (!reply) throw new AppError('Reply not found', 404);
    const r = normalizeRole(role);
    const isAdmin = r === 'admin';
    if (!isAdmin) {
      if (reply.authorId !== userId) throw new AppError('Only the author can edit the reply', 403);
      if (Date.now() - new Date(reply.createdAt).getTime() > REPLY_EDIT_WINDOW_MS) {
        throw new AppError('Edit window has expired (15 minutes)', 403);
      }
    }
    return prisma.discussionReply.update({
      where: { id: replyId },
      data: { content: input.content },
      include: {
        author: { select: { id: true, fullName: true, username: true, role: true, avatar: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async deleteReply(replyId: number, userId: number, role: string) {
    const reply = await prisma.discussionReply.findUnique({
      where: { id: replyId },
      include: { discussion: true },
    });
    if (!reply) throw new AppError('Reply not found', 404);
    const r = normalizeRole(role);
    const isAdmin = r === 'admin';
    const isAuthor = reply.authorId === userId;
    let canModerate = false;
    if (reply.discussion.scope === 'CLASS' && reply.discussion.classId !== null) {
      try {
        const access = await this.getClassAccess(reply.discussion.classId, userId, role);
        canModerate = access.canModerate;
      } catch {
        canModerate = false;
      }
    }
    if (!isAdmin && !isAuthor && !canModerate) {
      throw new AppError('You do not have permission to delete this reply', 403);
    }
    const attachments = await prisma.discussionAttachment.findMany({
      where: { replyId },
      select: { type: true, url: true },
    });
    await prisma.discussionReply.delete({ where: { id: replyId } });
    await this.removeStoredAttachments(attachments);
    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────────────
  // Admin overview
  // ─────────────────────────────────────────────────────────────
  async getAttachmentDownloadUrl(attachmentId: number, userId: number, role: string) {
    const attachment = await prisma.discussionAttachment.findUnique({
      where: { id: attachmentId },
      include: { discussion: true },
    });
    if (!attachment) throw new AppError('Attachment not found', 404);

    const r = normalizeRole(role);
    if (r !== 'admin' && attachment.discussion.scope === 'CLASS' && attachment.discussion.classId !== null) {
      await this.getClassAccess(attachment.discussion.classId, userId, role);
    }

    if (attachment.type === 'LINK') {
      return { url: attachment.url };
    }

    const url = await getMinioClient().presignedGetObject(
      env.minio.bucket,
      attachment.url,
      10 * 60,
    );
    return { url };
  }

  async adminListDiscussions(query: ListDiscussionsQuery) {
    const where: Prisma.DiscussionWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.scope) where.scope = query.scope;
    if (query.classId !== undefined) where.classId = query.classId;
    if (query.authorId) where.authorId = query.authorId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const total = await prisma.discussion.count({ where });
    const data = await prisma.discussion.findMany({
      where,
      include: {
        author: { select: { id: true, fullName: true, username: true, role: true } },
        class: { select: { id: true, name: true, gradeLevel: true } },
        attachments: { orderBy: { createdAt: 'asc' } },
        _count: { select: { replies: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}

export const discussionService = new DiscussionService();
