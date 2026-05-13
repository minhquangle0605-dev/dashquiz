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

  async listStudents(classId: number, query: ListStudentsQuery) {
    const classEntity = await prisma.class.findUnique({ where: { id: classId } });
    if (!classEntity) throw new AppError('Class not found', 404);

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
        ...cs.student,
        enrolledAt: cs.enrolledAt,
      })),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  // ═══════════════════════════════════════════════
  // ADD STUDENTS TO CLASS
  // ═══════════════════════════════════════════════

  async addStudents(classId: number, data: AddStudentsInput, userId: number, role: string) {
    const classEntity = await prisma.class.findUnique({ where: { id: classId } });
    if (!classEntity) throw new AppError('Class not found', 404);

    if (role === 'teacher' && classEntity.teacherId !== userId) {
      throw new AppError('You can only manage your own classes', 403);
    }

    const studentRole = await prisma.role.findFirst({ where: { name: 'student' } });
    if (!studentRole) throw new AppError('Student role not configured', 500);

    const students = await prisma.user.findMany({
      where: { id: { in: data.userIds }, roleId: studentRole.id },
      select: { id: true },
    });

    const foundIds = new Set(students.map((s) => s.id));
    const invalidIds = data.userIds.filter((uid) => !foundIds.has(uid));
    if (invalidIds.length > 0) {
      throw new AppError(`Students not found or not student role: ${invalidIds.join(', ')}`, 404);
    }

    const existing = await prisma.classStudent.findMany({
      where: { classId, studentId: { in: data.userIds } },
      select: { studentId: true },
    });
    const alreadyEnrolled = new Set(existing.map((cs) => cs.studentId));
    const newIds = data.userIds.filter((uid) => !alreadyEnrolled.has(uid));

    if (newIds.length === 0) {
      return {
        success: true,
        message: 'All students already enrolled in this class',
        data: { added: 0, skipped: data.userIds.length },
      };
    }

    await prisma.classStudent.createMany({
      data: newIds.map((studentId) => ({ classId, studentId })),
    });

    return {
      success: true,
      message: `Added ${newIds.length} student(s) to class`,
      data: {
        added: newIds.length,
        skipped: data.userIds.length - newIds.length,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // REMOVE STUDENT FROM CLASS
  // ═══════════════════════════════════════════════

  async removeStudent(classId: number, studentId: number, userId: number, role: string) {
    const classEntity = await prisma.class.findUnique({ where: { id: classId } });
    if (!classEntity) throw new AppError('Class not found', 404);

    if (role === 'teacher' && classEntity.teacherId !== userId) {
      throw new AppError('You can only manage your own classes', 403);
    }

    const enrollment = await prisma.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
    });

    if (!enrollment) {
      throw new AppError('Student is not enrolled in this class', 404);
    }

    await prisma.classStudent.delete({
      where: { classId_studentId: { classId, studentId } },
    });

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
    const classEntity = await prisma.class.findUnique({ where: { id: classId } });
    if (!classEntity) throw new AppError('Class not found', 404);

    if (role === 'teacher' && classEntity.teacherId !== userId) {
      throw new AppError('You can only manage your own classes', 403);
    }

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

    const studentRole = await prisma.role.findFirst({ where: { name: 'student' } });
    if (!studentRole) throw new AppError('Student role not configured', 500);

    const foundStudents = await prisma.user.findMany({
      where: {
        roleId: studentRole.id,
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
      await prisma.classStudent.createMany({
        data: newIds.map((studentId) => ({ classId, studentId })),
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
