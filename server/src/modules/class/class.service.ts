import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { isCoreSubjectCode } from '../../constants/subjects';
import { PAGINATION } from '../../utils/constants';
import type {
  CreateClassInput,
  UpdateClassInput,
  AddStudentsInput,
  ListClassesQuery,
  ListStudentsQuery,
} from './class.validation';

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ExcelStudentRow {
  username?: string;
  full_name?: string;
}

export class ClassService {
  private normalizeRole(role: string): string {
    return role.toLowerCase();
  }

  private async getClassAccess(classId: number, userId: number, role: string) {
    const classEntity = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        memberRoles: { where: { userId }, select: { role: true } },
        classStudents: { where: { studentId: userId }, select: { studentId: true } },
      },
    });

    if (!classEntity) throw new AppError('Class not found', 404);

    const normalizedRole = this.normalizeRole(role);
    const isAdmin = normalizedRole === 'admin';
    const isOwner = normalizedRole === 'teacher' && classEntity.teacherId === userId;
    const assignedRole = classEntity.memberRoles[0]?.role ?? null;
    const isEnrolledStudent =
      normalizedRole === 'student' && classEntity.classStudents.length > 0;
    const isStaffRole =
      assignedRole === 'TEACHER' ||
      assignedRole === 'TA' ||
      assignedRole === 'NON_EDITING_TEACHER';

    if (!isAdmin && !isOwner && !isStaffRole && !isEnrolledStudent) {
      throw new AppError('You do not have access to this class', 403);
    }

    const canManageContent =
      isAdmin || isOwner || assignedRole === 'TEACHER';
    const canManageLearners =
      isAdmin || isOwner || assignedRole === 'TEACHER' || assignedRole === 'TA';
    const canGrade =
      canManageLearners || assignedRole === 'NON_EDITING_TEACHER';

    return {
      classEntity,
      assignedRole,
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
      isStudent: isEnrolledStudent,
      isTeacherLike: canGrade,
    };
  }

  private async assertTeacherCanManageClass(classId: number, userId: number, role: string) {
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canManageContent) {
      throw new AppError('You cannot edit content in this class', 403);
    }
    return access;
  }

  private async assertTeacherCanManageLearners(classId: number, userId: number, role: string) {
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canManageLearners) {
      throw new AppError('You cannot manage learners in this class', 403);
    }
    return access;
  }

  private async assertTeacherCanGrade(classId: number, userId: number, role: string) {
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

  private async logClassActivity(
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

  // ═══════════════════════════════════════════════
  // LIST CLASSES
  // ═══════════════════════════════════════════════

  async listClasses(query: ListClassesQuery, userId: number, role: string) {
    const page = query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Prisma.ClassWhereInput = {};

    if (role === 'teacher') {
      where.teacherId = userId;
    }

    if (query.semesterId) where.semesterId = query.semesterId;
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.gradeLevel) where.gradeLevel = query.gradeLevel;

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.class.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Classes retrieved successfully',
      data: classes,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  // ═══════════════════════════════════════════════
  // LIST CLASSES THE AUTHENTICATED STUDENT IS ENROLLED IN
  // ═══════════════════════════════════════════════

  async listMyEnrolledClasses(studentId: number) {
    const enrollments = await prisma.classStudent.findMany({
      where: { studentId },
      include: {
        class: {
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
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const classes = enrollments.map((e) => ({
      ...e.class,
      enrolledAt: e.enrolledAt,
    }));

    return {
      success: true,
      message: 'My classes retrieved successfully',
      data: classes,
    };
  }

  // ═══════════════════════════════════════════════
  // CREATE CLASS
  // ═══════════════════════════════════════════════

  async createClass(data: CreateClassInput, teacherId: number) {
    let resolvedSemesterId = data.semesterId;

    if (data.academicYearString) {
      let academicYear = await prisma.academicYear.findFirst({
        where: { name: data.academicYearString },
      });

      if (!academicYear) {
        const startYearMatch = data.academicYearString.match(/(\d{4})/);
        const startYear = startYearMatch ? parseInt(startYearMatch[1], 10) : new Date().getFullYear();
        academicYear = await prisma.academicYear.create({
          data: {
            name: data.academicYearString,
            startDate: new Date(`${startYear}-09-01`),
            endDate: new Date(`${startYear + 1}-06-30`),
            isCurrent: true,
          },
        });
      }

      let defaultSemester = await prisma.semester.findFirst({
        where: { academicYearId: academicYear.id },
      });

      if (!defaultSemester) {
        defaultSemester = await prisma.semester.create({
          data: {
            name: 'Học kỳ 1',
            academicYearId: academicYear.id,
            startDate: academicYear.startDate,
            endDate: new Date(`${academicYear.startDate.getFullYear() + 1}-01-15`),
          },
        });
      }

      resolvedSemesterId = defaultSemester.id;
    }

    if (!resolvedSemesterId) {
      throw new AppError('Semester is required', 400);
    }

    const [semester, subject] = await Promise.all([
      prisma.semester.findUnique({ where: { id: resolvedSemesterId } }),
      prisma.subject.findUnique({ where: { id: data.subjectId } }),
    ]);

    if (!semester) throw new AppError('Semester not found', 404);
    if (!subject || !isCoreSubjectCode(subject.code)) throw new AppError('Subject not found', 404);

    const classEntity = await prisma.class.create({
      data: {
        name: data.name,
        gradeLevel: data.gradeLevel,
        semesterId: resolvedSemesterId,
        teacherId,
        subjectId: data.subjectId,
      },
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
      },
    });

    return {
      success: true,
      message: 'Class created successfully',
      data: classEntity,
    };
  }

  // ═══════════════════════════════════════════════
  // UPDATE CLASS
  // ═══════════════════════════════════════════════

  async updateClass(id: number, data: UpdateClassInput, userId: number, role: string) {
    const classEntity = await prisma.class.findUnique({ where: { id } });
    if (!classEntity) throw new AppError('Class not found', 404);

    if (role === 'teacher' && classEntity.teacherId !== userId) {
      throw new AppError('You can only edit your own classes', 403);
    }

    let resolvedSemesterId = data.semesterId;

    if (data.academicYearString) {
      let academicYear = await prisma.academicYear.findFirst({
        where: { name: data.academicYearString },
      });

      if (!academicYear) {
        const startYearMatch = data.academicYearString.match(/(\d{4})/);
        const startYear = startYearMatch ? parseInt(startYearMatch[1], 10) : new Date().getFullYear();
        academicYear = await prisma.academicYear.create({
          data: {
            name: data.academicYearString,
            startDate: new Date(`${startYear}-09-01`),
            endDate: new Date(`${startYear + 1}-06-30`),
            isCurrent: true,
          },
        });
      }

      let defaultSemester = await prisma.semester.findFirst({
        where: { academicYearId: academicYear.id },
      });

      if (!defaultSemester) {
        defaultSemester = await prisma.semester.create({
          data: {
            name: 'Học kỳ 1',
            academicYearId: academicYear.id,
            startDate: academicYear.startDate,
            endDate: new Date(`${academicYear.startDate.getFullYear() + 1}-01-15`),
          },
        });
      }

      resolvedSemesterId = defaultSemester.id;
    }

    if (resolvedSemesterId) {
      const semester = await prisma.semester.findUnique({ where: { id: resolvedSemesterId } });
      if (!semester) throw new AppError('Semester not found', 404);
    }

    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject || !isCoreSubjectCode(subject.code)) throw new AppError('Subject not found', 404);
    }

    const updated = await prisma.class.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.gradeLevel !== undefined && { gradeLevel: data.gradeLevel }),
        ...(resolvedSemesterId !== undefined && { semesterId: resolvedSemesterId }),
        ...(data.subjectId !== undefined && { subjectId: data.subjectId }),
      },
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
      },
    });

    return {
      success: true,
      message: 'Class updated successfully',
      data: updated,
    };
  }

  // ═══════════════════════════════════════════════
  // LIST STUDENTS IN CLASS
  // ═══════════════════════════════════════════════

  async listClassmates(classId: number, userId: number, role: string) {
    // Access guard: must be enrolled in the class or staff
    const access = await this.getClassAccess(classId, userId, role);
    const allowed = access.isStudent || access.capabilities.canViewParticipants;
    if (!allowed) {
      throw new AppError('You do not have access to this class roster', 403);
    }

    const students = await prisma.classStudent.findMany({
      where: { classId },
      include: {
        student: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      orderBy: { enrolledAt: 'asc' },
    });

    return {
      success: true,
      message: 'Classmates retrieved successfully',
      data: students.map((cs) => ({
        classId: cs.classId,
        studentId: cs.studentId,
        enrolledAt: cs.enrolledAt,
        student: {
          ...cs.student,
          phone: null,
        },
      })),
    };
  }

  async listStudents(classId: number, query: ListStudentsQuery, userId: number, role: string) {
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canViewParticipants) {
      throw new AppError('Students cannot view participant lists', 403);
    }

    const page = query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? 50, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Prisma.ClassStudentWhereInput = { classId };

    if (query.search) {
      where.student = {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { username: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [students, total] = await Promise.all([
      prisma.classStudent.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              username: true,
              fullName: true,
              phone: true,
              avatar: true,
              status: true,
            },
          },
        },
        orderBy: { enrolledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.classStudent.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Students retrieved successfully',
      data: students.map((cs) => ({
        classId: cs.classId,
        studentId: cs.studentId,
        enrolledAt: cs.enrolledAt,
        student: cs.student,
      })),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  // ═══════════════════════════════════════════════
  // ADD STUDENTS TO CLASS
  // ═══════════════════════════════════════════════

  async addStudents(classId: number, data: AddStudentsInput, userId: number, role: string) {
    await this.assertTeacherCanManageLearners(classId, userId, role);

    const ids = data.userIds ?? data.studentIds ?? [];
    if (ids.length === 0) {
      throw new AppError('At least one student ID is required', 400);
    }

    const students = await prisma.user.findMany({
      where: { id: { in: ids }, role: 'STUDENT' },
      select: { id: true },
    });

    const foundIds = new Set(students.map((s) => s.id));
    const invalidIds = ids.filter((uid) => !foundIds.has(uid));
    if (invalidIds.length > 0) {
      throw new AppError(`Students not found or not student role: ${invalidIds.join(', ')}`, 404);
    }

    const existing = await prisma.classStudent.findMany({
      where: { classId, studentId: { in: ids } },
      select: { studentId: true },
    });
    const alreadyEnrolled = new Set(existing.map((cs) => cs.studentId));
    const newIds = ids.filter((uid) => !alreadyEnrolled.has(uid));

    if (newIds.length === 0) {
      return {
        success: true,
        message: 'All students already enrolled in this class',
        data: { added: 0, skipped: ids.length },
      };
    }

    await prisma.$transaction([
      prisma.classStudent.createMany({
        data: newIds.map((studentId) => ({ classId, studentId })),
      }),
      prisma.classMemberRoleAssignment.createMany({
        data: newIds.map((studentId) => ({ classId, userId: studentId, role: 'STUDENT' })),
        skipDuplicates: true,
      }),
    ]);

    await this.logClassActivity(classId, userId, 'ADD_STUDENTS', 'class_student', undefined, {
      count: newIds.length,
    });

    return {
      success: true,
      message: `Added ${newIds.length} student(s) to class`,
      data: {
        added: newIds.length,
        skipped: ids.length - newIds.length,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // SEARCH STUDENTS AVAILABLE TO ADD TO A CLASS
  // ═══════════════════════════════════════════════

  async listAvailableStudents(
    classId: number,
    query: { search?: string; limit?: number; gradeLevel?: number; homeroomClassName?: string },
    userId: number,
    role: string,
  ) {
    await this.assertTeacherCanManageLearners(classId, userId, role);

    const limit = Math.min(query.limit ?? 100, 500);

    const enrolled = await prisma.classStudent.findMany({
      where: { classId },
      select: { studentId: true },
    });
    const enrolledIds = enrolled.map((cs) => cs.studentId);

    const andClauses: Prisma.UserWhereInput[] = [];

    // Filter by grade level: students whose homeroom class is grade X
    // OR whose studentCode is formatted "C{gradeLevel}…" (covers imported users).
    if (query.gradeLevel && [10, 11, 12].includes(query.gradeLevel)) {
      andClauses.push({
        OR: [
          { studentProfile: { class: { gradeLevel: query.gradeLevel } } },
          { studentProfile: { studentCode: { startsWith: `C${query.gradeLevel}` } } },
          { studentProfile: { homeroomClassName: { startsWith: String(query.gradeLevel) } } },
          { username: { startsWith: `C${query.gradeLevel}`, mode: 'insensitive' } },
        ],
      });
    }

    // Filter by homeroom class name:
    //   1) StudentProfile.homeroomClassName matches (string captured at import time)
    //   2) StudentProfile.class.name matches (legacy linkage via classId)
    //   3) Student is already enrolled in ANY other class with that name
    //      (allows copying roster from one subject teacher to another)
    if (query.homeroomClassName && query.homeroomClassName.trim()) {
      const name = query.homeroomClassName.trim();
      const peerClasses = await prisma.class.findMany({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      const peerClassIds = peerClasses.map((c) => c.id);

      const orClauses: Prisma.UserWhereInput[] = [
        { studentProfile: { homeroomClassName: { equals: name, mode: 'insensitive' } } },
        { studentProfile: { class: { name: { equals: name, mode: 'insensitive' } } } },
      ];
      if (peerClassIds.length > 0) {
        orClauses.push({ enrolledClasses: { some: { classId: { in: peerClassIds } } } });
      }

      andClauses.push({ OR: orClauses });
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      andClauses.push({
        OR: [
          { fullName: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.UserWhereInput = {
      role: 'STUDENT',
      ...(enrolledIds.length > 0 ? { id: { notIn: enrolledIds } } : {}),
      ...(andClauses.length > 0 ? { AND: andClauses } : {}),
    };

    const students = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        fullName: true,
        avatar: true,
        status: true,
        studentProfile: {
          select: {
            studentCode: true,
            homeroomClassName: true,
            class: { select: { id: true, name: true, gradeLevel: true } },
          },
        },
      },
      orderBy: [{ fullName: 'asc' }, { username: 'asc' }],
      take: limit,
    });

    const inferGradeFromName = (name?: string | null): number | null => {
      if (!name) return null;
      const m = name.match(/^(10|11|12)/);
      return m ? Number(m[1]) : null;
    };

    const data = students.map((s) => {
      const homeroomName =
        s.studentProfile?.homeroomClassName ?? s.studentProfile?.class?.name ?? null;
      const grade =
        s.studentProfile?.class?.gradeLevel ??
        inferGradeFromName(s.studentProfile?.homeroomClassName) ??
        (s.studentProfile?.studentCode?.match(/^C(10|11|12)/)?.[1]
          ? Number(s.studentProfile.studentCode.match(/^C(10|11|12)/)?.[1])
          : s.username.match(/^C(10|11|12)/i)?.[1]
            ? Number(s.username.match(/^C(10|11|12)/i)?.[1])
            : null);
      return {
        id: s.id,
        username: s.username,
        fullName: s.fullName,
        avatar: s.avatar,
        status: s.status,
        studentCode: s.studentProfile?.studentCode ?? null,
        homeroomClassName: homeroomName,
        gradeLevel: grade,
      };
    });

    return {
      success: true,
      message: 'Available students retrieved successfully',
      data,
    };
  }

  // ═══════════════════════════════════════════════
  // LIST DISTINCT CLASS NAMES (for filter dropdown)
  // ═══════════════════════════════════════════════

  async listDistinctClassNames(gradeLevel?: number) {
    const inferGrade = (name: string): number | null => {
      const m = name.match(/^(10|11|12)/);
      return m ? Number(m[1]) : null;
    };

    const [classes, homerooms] = await Promise.all([
      prisma.class.findMany({
        where: gradeLevel ? { gradeLevel } : undefined,
        select: { name: true, gradeLevel: true },
        orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
      }),
      prisma.studentProfile.findMany({
        where: { homeroomClassName: { not: null } },
        select: { homeroomClassName: true },
        distinct: ['homeroomClassName'],
      }),
    ]);

    const seen = new Set<string>();
    const result: Array<{ name: string; gradeLevel: number }> = [];

    for (const c of classes) {
      const key = `${c.gradeLevel}|${c.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ name: c.name, gradeLevel: c.gradeLevel });
    }

    for (const h of homerooms) {
      const name = h.homeroomClassName;
      if (!name) continue;
      const g = inferGrade(name);
      if (!g) continue;
      if (gradeLevel && g !== gradeLevel) continue;
      const key = `${g}|${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ name, gradeLevel: g });
    }

    result.sort((a, b) =>
      a.gradeLevel !== b.gradeLevel ? a.gradeLevel - b.gradeLevel : a.name.localeCompare(b.name),
    );

    return { success: true, message: 'Class names retrieved', data: result };
  }

  // ═══════════════════════════════════════════════
  // REMOVE STUDENT FROM CLASS
  // ═══════════════════════════════════════════════

  async removeStudent(classId: number, studentId: number, userId: number, role: string) {
    await this.assertTeacherCanManageLearners(classId, userId, role);

    const enrollment = await prisma.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
    });

    if (!enrollment) {
      throw new AppError('Student is not enrolled in this class', 404);
    }

    await prisma.$transaction([
      prisma.classStudent.delete({
        where: { classId_studentId: { classId, studentId } },
      }),
      prisma.classMemberRoleAssignment.deleteMany({
        where: { classId, userId: studentId, role: 'STUDENT' },
      }),
    ]);

    await this.logClassActivity(classId, userId, 'REMOVE_STUDENT', 'class_student', studentId);

    return {
      success: true,
      message: 'Student removed from class successfully',
      data: null,
    };
  }

  // ═══════════════════════════════════════════════
  // IMPORT STUDENTS FROM EXCEL
  // ═══════════════════════════════════════════════

  async importStudentsFromExcel(
    classId: number,
    fileBuffer: Buffer,
    userId: number,
    role: string,
  ) {
    await this.assertTeacherCanManageLearners(classId, userId, role);

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new AppError('Excel file has no sheets', 400);

    const rows = XLSX.utils.sheet_to_json<ExcelStudentRow>(workbook.Sheets[sheetName], {
      defval: '',
    });

    if (rows.length === 0) throw new AppError('Excel file is empty', 400);

    const headers = Object.keys(rows[0] || {}).map((h) => h.toLowerCase().trim());
    const hasUsername = headers.includes('username');

    if (!hasUsername) {
      throw new AppError(
        'Excel must contain a "username" column to identify students',
        400,
      );
    }

    const errors: ImportError[] = [];
    const lookupUsernames: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const username = String(row.username || '').trim();

      if (!username) {
        errors.push({ row: rowNum, field: 'username', message: 'Username is empty' });
        continue;
      }

      lookupUsernames.push(username);
    }

    if (lookupUsernames.length === 0) {
      return {
        success: false,
        message: 'No valid student identifiers found in file',
        data: { enrolled: 0, failed: rows.length, errors },
      };
    }

    const foundStudents = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        username: { in: lookupUsernames },
      },
      select: { id: true, username: true },
    });

    const usernameMap = new Map(foundStudents.map((s) => [s.username.toLowerCase(), s.id]));

    const studentIds: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const username = String(row.username || '').trim().toLowerCase();

      const studentId = usernameMap.get(username);

      if (!studentId) {
        errors.push({
          row: rowNum,
          field: 'username',
          message: `Student not found: ${username}`,
        });
        continue;
      }

      studentIds.push(studentId);
    }

    if (studentIds.length === 0) {
      return {
        success: false,
        message: 'No matching students found in system',
        data: { enrolled: 0, failed: rows.length, errors },
      };
    }

    const existing = await prisma.classStudent.findMany({
      where: { classId, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const alreadyEnrolled = new Set(existing.map((cs) => cs.studentId));
    const uniqueIds = [...new Set(studentIds)];
    const newIds = uniqueIds.filter((id) => !alreadyEnrolled.has(id));

    if (newIds.length > 0) {
      await prisma.$transaction([
        prisma.classStudent.createMany({
          data: newIds.map((studentId) => ({ classId, studentId })),
        }),
        prisma.classMemberRoleAssignment.createMany({
          data: newIds.map((studentId) => ({ classId, userId: studentId, role: 'STUDENT' })),
          skipDuplicates: true,
        }),
      ]);
      await this.logClassActivity(classId, userId, 'IMPORT_STUDENTS', 'class_student', undefined, {
        count: newIds.length,
      });
    }

    return {
      success: true,
      message: `Imported ${newIds.length} student(s) into class`,
      data: {
        enrolled: newIds.length,
        skipped: uniqueIds.length - newIds.length,
        failed: rows.length - studentIds.length,
        total: rows.length,
        errors: errors.length > 0 ? errors : null,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // GENERATE STUDENT IMPORT TEMPLATE
  // ═══════════════════════════════════════════════

  generateImportTemplate(): Buffer {
    const sampleData = [
      { username: 'student001', full_name: 'Nguyễn Văn A' },
      { username: 'student002', full_name: 'Trần Thị B' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [{ wch: 20 }, { wch: 25 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    const instructionData = [
      ['Hướng dẫn Import Học sinh vào Lớp'],
      [''],
      ['Cột', 'Mô tả', 'Bắt buộc'],
      ['username', 'Tên đăng nhập của học sinh', 'Có'],
      ['full_name', 'Họ tên (chỉ để tham khảo, không dùng để lookup)', 'Không'],
      [''],
      ['Lưu ý:', 'Học sinh phải đã có tài khoản trong hệ thống với vai trò Student'],
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructionData);
    instructionSheet['!cols'] = [{ wch: 15 }, { wch: 55 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Huong dan');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}

export const classService = new ClassService();
