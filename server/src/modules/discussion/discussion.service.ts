import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type {
  ListDiscussionsQuery,
  CreateDiscussionInput,
  UpdateDiscussionInput,
  CreateReplyInput,
  UpdateReplyInput,
} from './discussion.validation';

const REPLY_EDIT_WINDOW_MS = 15 * 60 * 1000;

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
      throw new AppError('Bạn không có quyền truy cập lớp này', 403);
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
      throw new AppError('Bạn không có quyền truy cập lớp này', 403);
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
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, fullName: true, username: true, role: true, avatar: true },
            },
          },
        },
      },
    });
    if (!discussion) throw new AppError('Không tìm thấy bài viết', 404);

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
  async createDiscussion(input: CreateDiscussionInput, userId: number, role: string) {
    const r = normalizeRole(role);

    if (input.scope === 'GLOBAL') {
      // Only ADMIN may post to GLOBAL announcements; teachers may post GLOBAL discussions
      if (input.type === 'ANNOUNCEMENT' && r !== 'admin') {
        throw new AppError('Chỉ admin được tạo thông báo toàn trường', 403);
      }
      if (r === 'student') {
        throw new AppError('Học sinh chưa được tạo bài viết toàn trường', 403);
      }
    } else {
      // CLASS scope
      if (input.classId === undefined) throw new AppError('Thiếu classId', 400);
      const access = await this.getClassAccess(input.classId, userId, role);
      if (input.type === 'ANNOUNCEMENT' && !access.canAnnounce) {
        throw new AppError('Chỉ giáo viên hoặc admin được tạo thông báo lớp', 403);
      }
      if (!access.canPost) {
        throw new AppError('Bạn không được phép đăng bài trong lớp này', 403);
      }
    }

    return prisma.discussion.create({
      data: {
        scope: input.scope,
        type: input.type,
        classId: input.scope === 'CLASS' ? input.classId! : null,
        authorId: userId,
        title: input.title,
        content: input.content,
      },
      include: {
        author: { select: { id: true, fullName: true, username: true, role: true, avatar: true } },
        class: { select: { id: true, name: true, gradeLevel: true } },
        _count: { select: { replies: true } },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────
  async updateDiscussion(id: number, input: UpdateDiscussionInput, userId: number, role: string) {
    const discussion = await prisma.discussion.findUnique({ where: { id } });
    if (!discussion) throw new AppError('Không tìm thấy bài viết', 404);
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
          throw new AppError('Bạn không có quyền moderate bài viết này', 403);
        }
      } else {
        throw new AppError('Chỉ admin được moderate bài viết toàn trường', 403);
      }
    }

    if ((input.title !== undefined || input.content !== undefined) && !isAuthor && !isAdmin) {
      throw new AppError('Chỉ tác giả hoặc admin được sửa nội dung', 403);
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
        _count: { select: { replies: true } },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────────────────────
  async deleteDiscussion(id: number, userId: number, role: string) {
    const discussion = await prisma.discussion.findUnique({ where: { id } });
    if (!discussion) throw new AppError('Không tìm thấy bài viết', 404);
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
      throw new AppError('Bạn không có quyền xóa bài viết này', 403);
    }
    await prisma.discussion.delete({ where: { id } });
    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────────────
  // Reply: list/create/update/delete
  // ─────────────────────────────────────────────────────────────
  async createReply(discussionId: number, input: CreateReplyInput, userId: number, role: string) {
    const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
    if (!discussion) throw new AppError('Không tìm thấy bài viết', 404);
    if (discussion.isLocked) throw new AppError('Bài viết đã bị khóa, không thể trả lời', 403);

    const r = normalizeRole(role);
    if (discussion.scope === 'CLASS' && discussion.classId !== null && r !== 'admin') {
      const access = await this.getClassAccess(discussion.classId, userId, role);
      if (!access.canPost) throw new AppError('Bạn không được phép trả lời ở lớp này', 403);
    }

    return prisma.discussionReply.create({
      data: {
        discussionId,
        authorId: userId,
        content: input.content,
      },
      include: {
        author: { select: { id: true, fullName: true, username: true, role: true, avatar: true } },
      },
    });
  }

  async updateReply(replyId: number, input: UpdateReplyInput, userId: number, role: string) {
    const reply = await prisma.discussionReply.findUnique({ where: { id: replyId } });
    if (!reply) throw new AppError('Không tìm thấy reply', 404);
    const r = normalizeRole(role);
    const isAdmin = r === 'admin';
    if (!isAdmin) {
      if (reply.authorId !== userId) throw new AppError('Chỉ tác giả được sửa reply', 403);
      if (Date.now() - new Date(reply.createdAt).getTime() > REPLY_EDIT_WINDOW_MS) {
        throw new AppError('Đã quá thời gian được sửa (15 phút)', 403);
      }
    }
    return prisma.discussionReply.update({
      where: { id: replyId },
      data: { content: input.content },
      include: {
        author: { select: { id: true, fullName: true, username: true, role: true, avatar: true } },
      },
    });
  }

  async deleteReply(replyId: number, userId: number, role: string) {
    const reply = await prisma.discussionReply.findUnique({
      where: { id: replyId },
      include: { discussion: true },
    });
    if (!reply) throw new AppError('Không tìm thấy reply', 404);
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
      throw new AppError('Bạn không có quyền xóa reply này', 403);
    }
    await prisma.discussionReply.delete({ where: { id: replyId } });
    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────────────
  // Admin overview
  // ─────────────────────────────────────────────────────────────
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
