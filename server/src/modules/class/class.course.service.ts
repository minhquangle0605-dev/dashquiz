import type { ClassMemberRole, ClassResourceType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { getMinioClient } from '../../config/minio';
import { AppError } from '../../middlewares/errorHandler';
import { FILE_UPLOAD } from '../../utils/constants';
import { logger } from '../../utils/logger';
import type {
  AssignClassRoleInput,
  CreateActivityInput,
  CreateForumPostInput,
  CreateResourceInput,
  CreateSectionInput,
  GradeSubmissionInput,
  MarkCompletionInput,
  RecordAttendanceInput,
  SubmitActivityInput,
  UpdateActivityInput,
  UpdateResourceInput,
  UpdateSectionInput,
} from './class.validation';

export class ClassCourseService {
  private async getClassAccess(classId: number, userId: number, role: string) {
    const classEntity = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        memberRoles: { where: { userId }, select: { role: true } },
        classStudents: { where: { studentId: userId }, select: { studentId: true } },
      },
    });

    if (!classEntity) throw new AppError('Class not found', 404);

    const normalizedRole = role.toLowerCase();
    const isAdmin = normalizedRole === 'admin';
    const isOwner = normalizedRole === 'teacher' && classEntity.teacherId === userId;
    const assignedRole = classEntity.memberRoles[0]?.role ?? null;
    const isEnrolledStudent = normalizedRole === 'student' && classEntity.classStudents.length > 0;
    const isStaffRole =
      assignedRole === 'TEACHER' ||
      assignedRole === 'TA' ||
      assignedRole === 'NON_EDITING_TEACHER';

    if (!isAdmin && !isOwner && !isStaffRole && !isEnrolledStudent) {
      throw new AppError('You do not have access to this class', 403);
    }

    const canManageContent = isAdmin || isOwner || assignedRole === 'TEACHER';
    const canManageLearners =
      isAdmin || isOwner || assignedRole === 'TEACHER' || assignedRole === 'TA';
    const canGrade = canManageLearners || assignedRole === 'NON_EDITING_TEACHER';

    return {
      classEntity,
      assignedRole,
      isStudent: isEnrolledStudent,
      capabilities: {
        canViewContent: true,
        canManageContent,
        canCreateActivities: canManageContent,
        canManageLearners,
        canGrade,
        canViewParticipants: canManageLearners || assignedRole === 'NON_EDITING_TEACHER',
        canViewLogs: canGrade,
        canSubmit: isEnrolledStudent,
        canPostForum: isEnrolledStudent || canGrade,
        canOverridePermissions: isAdmin || isOwner,
      },
    };
  }

  private async assertCanManageContent(classId: number, userId: number, role: string) {
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canManageContent) {
      throw new AppError('You cannot edit content in this class', 403);
    }
    return access;
  }

  private async assertCanManageLearners(classId: number, userId: number, role: string) {
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canManageLearners) {
      throw new AppError('You cannot manage learners in this class', 403);
    }
    return access;
  }

  private async assertCanGrade(classId: number, userId: number, role: string) {
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canGrade) {
      throw new AppError('You cannot grade or monitor this class', 403);
    }
    return access;
  }

  private async ensureSectionBelongsToClass(sectionId: number | null | undefined, classId: number) {
    if (!sectionId) return;
    const section = await prisma.classSection.findUnique({ where: { id: sectionId } });
    if (!section || section.classId !== classId) {
      throw new AppError('Section not found in this class', 404);
    }
  }

  private async log(
    classId: number,
    actorId: number | null,
    action: string,
    targetType?: string,
    targetId?: number,
    metadata?: Prisma.InputJsonValue,
  ) {
    await prisma.classActivityLog.create({
      data: { classId, actorId, action, targetType, targetId, metadata },
    });
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160);
  }

  private isStoredObjectResource(type: ClassResourceType): boolean {
    return type === 'FILE' || type === 'IMAGE';
  }

  async getCourse(classId: number, userId: number, role: string) {
    const access = await this.getClassAccess(classId, userId, role);
    const [classEntity, sections, standaloneResources, standaloneActivities, completions, submissions] =
      await Promise.all([
        prisma.class.findUnique({
          where: { id: classId },
          include: {
            teacher: { select: { id: true, fullName: true } },
            subject: { select: { id: true, name: true, code: true } },
            semester: {
              select: {
                id: true,
                name: true,
                academicYear: { select: { id: true, name: true } },
              },
            },
            _count: { select: { classStudents: true, examAssignments: true } },
          },
        }),
        prisma.classSection.findMany({
          where: { classId, ...(access.isStudent ? { isPublished: true } : {}) },
          include: {
            resources: {
              where: access.isStudent ? { isPublished: true } : {},
              orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
            },
            activities: {
              where: access.isStudent ? { status: 'PUBLISHED' } : {},
              orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.classResource.findMany({
          where: { classId, sectionId: null, ...(access.isStudent ? { isPublished: true } : {}) },
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.classActivity.findMany({
          where: { classId, sectionId: null, ...(access.isStudent ? { status: 'PUBLISHED' } : {}) },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
        }),
        access.isStudent
          ? prisma.classCompletion.findMany({
              where: { classId, studentId: userId },
              select: { resourceId: true, activityId: true, completedAt: true },
            })
          : Promise.resolve([]),
        access.isStudent
          ? prisma.classSubmission.findMany({
              where: { studentId: userId, activity: { classId } },
            })
          : Promise.resolve([]),
      ]);

    return {
      success: true,
      message: 'Class course retrieved successfully',
      data: {
        class: classEntity,
        role: access.assignedRole ?? (access.isStudent ? 'STUDENT' : 'TEACHER'),
        capabilities: access.capabilities,
        sections,
        standaloneResources,
        standaloneActivities,
        myCompletions: completions,
        mySubmissions: submissions,
      },
    };
  }

  async createSection(classId: number, data: CreateSectionInput, userId: number, role: string) {
    await this.assertCanManageContent(classId, userId, role);
    const section = await prisma.classSection.create({
      data: {
        classId,
        title: data.title,
        description: data.description,
        orderIndex: data.orderIndex ?? 0,
        isPublished: data.isPublished ?? true,
        createdBy: userId,
      },
    });
    await this.log(classId, userId, 'CREATE_SECTION', 'class_section', section.id);
    return { success: true, message: 'Section created successfully', data: section };
  }

  async updateSection(
    classId: number,
    sectionId: number,
    data: UpdateSectionInput,
    userId: number,
    role: string,
  ) {
    await this.assertCanManageContent(classId, userId, role);
    const existing = await prisma.classSection.findUnique({ where: { id: sectionId } });
    if (!existing || existing.classId !== classId) throw new AppError('Section not found', 404);
    const section = await prisma.classSection.update({
      where: { id: sectionId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      },
    });
    await this.log(classId, userId, 'UPDATE_SECTION', 'class_section', section.id);
    return { success: true, message: 'Section updated successfully', data: section };
  }

  async deleteSection(classId: number, sectionId: number, userId: number, role: string) {
    await this.assertCanManageContent(classId, userId, role);
    const existing = await prisma.classSection.findUnique({ where: { id: sectionId } });
    if (!existing || existing.classId !== classId) throw new AppError('Section not found', 404);
    const resources = await prisma.classResource.findMany({
      where: { classId, sectionId },
      select: { id: true, type: true, url: true },
    });

    await prisma.$transaction([
      prisma.classResource.deleteMany({ where: { classId, sectionId } }),
      prisma.classSection.delete({ where: { id: sectionId } }),
    ]);

    await Promise.all(
      resources
        .filter((resource) => this.isStoredObjectResource(resource.type) && resource.url)
        .map(async (resource) => {
          try {
            await getMinioClient().removeObject(env.minio.bucket, resource.url!);
          } catch (error) {
            logger.warn('Failed to remove class resource object after section delete', {
              classId,
              sectionId,
              resourceId: resource.id,
              objectName: resource.url,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }),
    );

    await this.log(classId, userId, 'DELETE_SECTION', 'class_section', sectionId, {
      deletedResourceCount: resources.length,
    });
    return { success: true, message: 'Section deleted successfully', data: null };
  }

  async createResource(classId: number, data: CreateResourceInput, userId: number, role: string) {
    await this.assertCanManageContent(classId, userId, role);
    await this.ensureSectionBelongsToClass(data.sectionId, classId);
    const resource = await prisma.classResource.create({
      data: {
        classId,
        sectionId: data.sectionId ?? null,
        type: data.type,
        title: data.title,
        description: data.description,
        content: data.content,
        url: data.url,
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSizeBytes: data.fileSizeBytes,
        isPublished: data.isPublished ?? true,
        orderIndex: data.orderIndex ?? 0,
        createdBy: userId,
      },
    });
    await this.log(classId, userId, 'CREATE_RESOURCE', 'class_resource', resource.id);
    return { success: true, message: 'Resource created successfully', data: resource };
  }

  async uploadResourceFile(
    classId: number,
    body: Partial<CreateResourceInput>,
    file: Express.Multer.File,
    userId: number,
    role: string,
  ) {
    await this.assertCanManageContent(classId, userId, role);
    await this.ensureSectionBelongsToClass(body.sectionId, classId);
    const type = body.type === 'IMAGE' ? 'IMAGE' : 'FILE';
    if (type === 'IMAGE') {
      const allowedImageTypes: readonly string[] = FILE_UPLOAD.ALLOWED_CLASS_IMAGE_TYPES;
      if (!allowedImageTypes.includes(file.mimetype)) {
        throw new AppError('Only JPG, PNG, WebP, and GIF images are allowed', 400);
      }
      if (file.size > FILE_UPLOAD.MAX_CLASS_IMAGE_RESOURCE_SIZE) {
        throw new AppError('Image resources must be 10MB or smaller', 400);
      }
    }
    const objectName = `classes/${classId}/${Date.now()}-${this.sanitizeFilename(file.originalname)}`;
    await getMinioClient().putObject(env.minio.bucket, objectName, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });
    const resource = await prisma.classResource.create({
      data: {
        classId,
        sectionId: body.sectionId ?? null,
        type,
        title: body.title || file.originalname,
        description: body.description,
        url: objectName,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        isPublished: body.isPublished ?? true,
        orderIndex: body.orderIndex ?? 0,
        createdBy: userId,
      },
    });
    await this.log(classId, userId, 'UPLOAD_RESOURCE_FILE', 'class_resource', resource.id);
    return { success: true, message: 'Resource file uploaded successfully', data: resource };
  }

  async updateResource(
    classId: number,
    resourceId: number,
    data: UpdateResourceInput,
    userId: number,
    role: string,
  ) {
    await this.assertCanManageContent(classId, userId, role);
    const existing = await prisma.classResource.findUnique({ where: { id: resourceId } });
    if (!existing || existing.classId !== classId) throw new AppError('Resource not found', 404);
    await this.ensureSectionBelongsToClass(data.sectionId, classId);
    const resource = await prisma.classResource.update({
      where: { id: resourceId },
      data: {
        ...(data.sectionId !== undefined && { sectionId: data.sectionId }),
        ...(data.type !== undefined && { type: data.type as ClassResourceType }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.fileName !== undefined && { fileName: data.fileName }),
        ...(data.mimeType !== undefined && { mimeType: data.mimeType }),
        ...(data.fileSizeBytes !== undefined && { fileSizeBytes: data.fileSizeBytes }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
      },
    });
    await this.log(classId, userId, 'UPDATE_RESOURCE', 'class_resource', resource.id);
    return { success: true, message: 'Resource updated successfully', data: resource };
  }

  async deleteResource(classId: number, resourceId: number, userId: number, role: string) {
    await this.assertCanManageContent(classId, userId, role);
    const existing = await prisma.classResource.findUnique({ where: { id: resourceId } });
    if (!existing || existing.classId !== classId) throw new AppError('Resource not found', 404);
    await prisma.classResource.delete({ where: { id: resourceId } });
    if (this.isStoredObjectResource(existing.type) && existing.url) {
      try {
        await getMinioClient().removeObject(env.minio.bucket, existing.url);
      } catch (error) {
        logger.warn('Failed to remove class resource object after database delete', {
          classId,
          resourceId,
          objectName: existing.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await this.log(classId, userId, 'DELETE_RESOURCE', 'class_resource', resourceId);
    return { success: true, message: 'Resource deleted successfully', data: null };
  }

  async getResourceDownloadUrl(resourceId: number, userId: number, role: string) {
    const resource = await prisma.classResource.findUnique({ where: { id: resourceId } });
    if (!resource) throw new AppError('Resource not found', 404);
    await this.getClassAccess(resource.classId, userId, role);
    if (!this.isStoredObjectResource(resource.type) || !resource.url) {
      throw new AppError('Resource is not a downloadable file', 400);
    }
    const url = await getMinioClient().presignedGetObject(env.minio.bucket, resource.url, 10 * 60);
    await this.log(resource.classId, userId, 'DOWNLOAD_RESOURCE', 'class_resource', resource.id);
    return { success: true, message: 'Download URL generated', data: { url } };
  }

  async createActivity(classId: number, data: CreateActivityInput, userId: number, role: string) {
    await this.assertCanManageContent(classId, userId, role);
    await this.ensureSectionBelongsToClass(data.sectionId, classId);
    const activity = await prisma.classActivity.create({
      data: {
        classId,
        sectionId: data.sectionId ?? null,
        gradeComponentType: data.gradeComponentType ?? null,
        type: data.type,
        title: data.title,
        instructions: data.instructions,
        content: data.content,
        status: data.status ?? 'DRAFT',
        dueAt: data.dueAt,
        maxScore: data.maxScore,
        allowLate: data.allowLate ?? false,
        showGrades: data.showGrades ?? true,
        allowStudentPosts: data.allowStudentPosts ?? true,
        createdBy: userId,
      },
    });
    await this.log(classId, userId, 'CREATE_ACTIVITY', 'class_activity', activity.id);
    return { success: true, message: 'Activity created successfully', data: activity };
  }

  async updateActivity(
    classId: number,
    activityId: number,
    data: UpdateActivityInput,
    userId: number,
    role: string,
  ) {
    await this.assertCanManageContent(classId, userId, role);
    const existing = await prisma.classActivity.findUnique({ where: { id: activityId } });
    if (!existing || existing.classId !== classId) throw new AppError('Activity not found', 404);
    await this.ensureSectionBelongsToClass(data.sectionId, classId);
    const activity = await prisma.classActivity.update({
      where: { id: activityId },
      data: {
        ...(data.sectionId !== undefined && { sectionId: data.sectionId }),
        ...(data.gradeComponentType !== undefined && { gradeComponentType: data.gradeComponentType }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.instructions !== undefined && { instructions: data.instructions }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.dueAt !== undefined && { dueAt: data.dueAt }),
        ...(data.maxScore !== undefined && { maxScore: data.maxScore }),
        ...(data.allowLate !== undefined && { allowLate: data.allowLate }),
        ...(data.showGrades !== undefined && { showGrades: data.showGrades }),
        ...(data.allowStudentPosts !== undefined && { allowStudentPosts: data.allowStudentPosts }),
      },
    });
    await this.log(classId, userId, 'UPDATE_ACTIVITY', 'class_activity', activity.id);
    return { success: true, message: 'Activity updated successfully', data: activity };
  }

  async deleteActivity(classId: number, activityId: number, userId: number, role: string) {
    await this.assertCanManageContent(classId, userId, role);
    const existing = await prisma.classActivity.findUnique({ where: { id: activityId } });
    if (!existing || existing.classId !== classId) throw new AppError('Activity not found', 404);
    await prisma.classActivity.delete({ where: { id: activityId } });
    await this.log(classId, userId, 'DELETE_ACTIVITY', 'class_activity', activityId);
    return { success: true, message: 'Activity deleted successfully', data: null };
  }

  async submitActivity(activityId: number, data: SubmitActivityInput, userId: number, role: string) {
    const activity = await prisma.classActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new AppError('Activity not found', 404);
    const access = await this.getClassAccess(activity.classId, userId, role);
    if (!access.capabilities.canSubmit) {
      throw new AppError('Only enrolled students can submit activities', 403);
    }
    if (activity.status !== 'PUBLISHED') throw new AppError('Activity is not open', 400);
    if (activity.type === 'FORUM' || activity.type === 'ATTENDANCE') {
      throw new AppError('This activity type does not accept submissions', 400);
    }
    if (activity.dueAt && activity.dueAt < new Date() && !activity.allowLate) {
      throw new AppError('Submission deadline has passed', 400);
    }
    if (!data.content && !data.fileUrl) throw new AppError('Submission content or file is required', 400);

    const submission = await prisma.classSubmission.upsert({
      where: { activityId_studentId: { activityId, studentId: userId } },
      update: {
        content: data.content,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      create: {
        activityId,
        studentId: userId,
        content: data.content,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        status: 'SUBMITTED',
      },
    });
    await this.log(activity.classId, userId, 'SUBMIT_ACTIVITY', 'class_activity', activityId);
    return { success: true, message: 'Submission saved successfully', data: submission };
  }

  async listSubmissions(activityId: number, userId: number, role: string) {
    const activity = await prisma.classActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new AppError('Activity not found', 404);
    await this.assertCanGrade(activity.classId, userId, role);
    const submissions = await prisma.classSubmission.findMany({
      where: { activityId },
      include: {
        student: { select: { id: true, username: true, fullName: true, avatar: true } },
        grader: { select: { id: true, fullName: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return { success: true, message: 'Submissions retrieved successfully', data: submissions };
  }

  async gradeSubmission(submissionId: number, data: GradeSubmissionInput, userId: number, role: string) {
    const submission = await prisma.classSubmission.findUnique({
      where: { id: submissionId },
      include: { activity: true },
    });
    if (!submission) throw new AppError('Submission not found', 404);
    await this.assertCanGrade(submission.activity.classId, userId, role);
    if (
      data.score !== undefined &&
      submission.activity.maxScore !== null &&
      submission.activity.maxScore !== undefined &&
      data.score > submission.activity.maxScore
    ) {
      throw new AppError('Score cannot exceed activity max score', 400);
    }
    const updated = await prisma.classSubmission.update({
      where: { id: submissionId },
      data: {
        score: data.score,
        feedback: data.feedback,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedBy: userId,
      },
    });
    await this.log(submission.activity.classId, userId, 'GRADE_SUBMISSION', 'class_submission', submissionId);
    return { success: true, message: 'Submission graded successfully', data: updated };
  }

  async listForumPosts(activityId: number, userId: number, role: string) {
    const activity = await prisma.classActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new AppError('Activity not found', 404);
    const access = await this.getClassAccess(activity.classId, userId, role);
    if (access.isStudent && (activity.type !== 'FORUM' || activity.status !== 'PUBLISHED')) {
      throw new AppError('Forum is not available', 403);
    }
    const posts = await prisma.classForumPost.findMany({
      where: { activityId },
      include: { author: { select: { id: true, fullName: true, username: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, message: 'Forum posts retrieved successfully', data: posts };
  }

  async createForumPost(activityId: number, data: CreateForumPostInput, userId: number, role: string) {
    const activity = await prisma.classActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new AppError('Activity not found', 404);
    const access = await this.getClassAccess(activity.classId, userId, role);
    if (activity.type !== 'FORUM') throw new AppError('Activity is not a forum', 400);
    if (access.isStudent && (activity.status !== 'PUBLISHED' || !activity.allowStudentPosts)) {
      throw new AppError('Students cannot post in this forum', 403);
    }
    if (!access.capabilities.canPostForum) throw new AppError('You cannot post in this forum', 403);
    if (data.parentId) {
      const parent = await prisma.classForumPost.findUnique({ where: { id: data.parentId } });
      if (!parent || parent.activityId !== activityId) throw new AppError('Parent post not found', 404);
    }
    const post = await prisma.classForumPost.create({
      data: { activityId, authorId: userId, parentId: data.parentId, content: data.content },
      include: { author: { select: { id: true, fullName: true, username: true, role: true } } },
    });
    await this.log(activity.classId, userId, 'CREATE_FORUM_POST', 'class_forum_post', post.id);
    return { success: true, message: 'Forum post created successfully', data: post };
  }

  async recordAttendance(activityId: number, data: RecordAttendanceInput, userId: number, role: string) {
    const activity = await prisma.classActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new AppError('Activity not found', 404);
    if (activity.type !== 'ATTENDANCE') throw new AppError('Activity is not attendance', 400);
    await this.assertCanGrade(activity.classId, userId, role);
    const enrolled = await prisma.classStudent.findMany({
      where: { classId: activity.classId, studentId: { in: data.records.map((r) => r.studentId) } },
      select: { studentId: true },
    });
    const enrolledIds = new Set(enrolled.map((s) => s.studentId));
    const invalid = data.records.filter((r) => !enrolledIds.has(r.studentId));
    if (invalid.length > 0) {
      throw new AppError(`Students are not enrolled: ${invalid.map((r) => r.studentId).join(', ')}`, 400);
    }
    await prisma.$transaction(
      data.records.map((record) =>
        prisma.classAttendanceRecord.upsert({
          where: { activityId_studentId: { activityId, studentId: record.studentId } },
          update: {
            status: record.status,
            note: record.note,
            recordedBy: userId,
            recordedAt: new Date(),
          },
          create: {
            activityId,
            studentId: record.studentId,
            status: record.status,
            note: record.note,
            recordedBy: userId,
          },
        }),
      ),
    );
    await this.log(activity.classId, userId, 'RECORD_ATTENDANCE', 'class_activity', activityId);
    return { success: true, message: 'Attendance recorded successfully', data: { count: data.records.length } };
  }

  async markCompletion(classId: number, data: MarkCompletionInput, userId: number, role: string) {
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canSubmit) {
      throw new AppError('Only enrolled students can mark completion', 403);
    }
    if (data.resourceId) {
      const resource = await prisma.classResource.findUnique({ where: { id: data.resourceId } });
      if (!resource || resource.classId !== classId || !resource.isPublished) {
        throw new AppError('Resource not found', 404);
      }
      const completion = await prisma.classCompletion.upsert({
        where: { studentId_resourceId: { studentId: userId, resourceId: data.resourceId } },
        update: { completedAt: new Date() },
        create: { classId, studentId: userId, resourceId: data.resourceId },
      });
      await this.log(classId, userId, 'MARK_RESOURCE_COMPLETE', 'class_resource', data.resourceId);
      return { success: true, message: 'Completion marked', data: completion };
    }
    const activity = await prisma.classActivity.findUnique({ where: { id: data.activityId } });
    if (!activity || activity.classId !== classId || activity.status !== 'PUBLISHED') {
      throw new AppError('Activity not found', 404);
    }
    const completion = await prisma.classCompletion.upsert({
      where: { studentId_activityId: { studentId: userId, activityId: data.activityId! } },
      update: { completedAt: new Date() },
      create: { classId, studentId: userId, activityId: data.activityId },
    });
    await this.log(classId, userId, 'MARK_ACTIVITY_COMPLETE', 'class_activity', data.activityId);
    return { success: true, message: 'Completion marked', data: completion };
  }

  async assignRole(classId: number, data: AssignClassRoleInput, userId: number, role: string) {
    await this.assertCanManageLearners(classId, userId, role);
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canOverridePermissions && data.role !== 'STUDENT') {
      throw new AppError('Only the class teacher or admin can assign staff roles', 403);
    }
    const target = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!target) throw new AppError('User not found', 404);
    if (data.role === 'STUDENT') {
      if (target.role !== 'STUDENT') throw new AppError('Target user must be a student', 400);
      await prisma.$transaction([
        prisma.classStudent.upsert({
          where: { classId_studentId: { classId, studentId: data.userId } },
          update: {},
          create: { classId, studentId: data.userId },
        }),
        prisma.classMemberRoleAssignment.upsert({
          where: { classId_userId: { classId, userId: data.userId } },
          update: { role: 'STUDENT' },
          create: { classId, userId: data.userId, role: 'STUDENT' },
        }),
      ]);
    } else {
      if (target.role !== 'TEACHER' && target.role !== 'ADMIN') {
        throw new AppError('Staff roles can only be assigned to teacher/admin users', 400);
      }
      await prisma.classMemberRoleAssignment.upsert({
        where: { classId_userId: { classId, userId: data.userId } },
        update: { role: data.role as ClassMemberRole },
        create: { classId, userId: data.userId, role: data.role as ClassMemberRole },
      });
    }
    await this.log(classId, userId, 'ASSIGN_CLASS_ROLE', 'class_member_role', data.userId, {
      role: data.role,
    });
    return { success: true, message: 'Class role assigned successfully', data: null };
  }

  async listLogs(classId: number, userId: number, role: string) {
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canViewLogs) throw new AppError('Students cannot view class logs', 403);
    const logs = await prisma.classActivityLog.findMany({
      where: { classId },
      include: { actor: { select: { id: true, username: true, fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { success: true, message: 'Class logs retrieved successfully', data: logs };
  }
}

export const classCourseService = new ClassCourseService();
