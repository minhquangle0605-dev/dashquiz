import bcrypt from 'bcryptjs';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/database';
import { getMinioClient } from '../../config/minio';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { FILE_UPLOAD, PAGINATION } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { buildAccountUsername } from '../../utils/username';
import type {
  UpdateProfileInput,
  ChangePasswordInput,
  ListUsersQuery,
  CreateUserInput,
  UpdateUserInput,
  ChangeRoleInput,
} from './user.validation';

export class UserService {
  // ═══════════════════════════════════════════════
  // USER SELF-SERVICE
  // ═══════════════════════════════════════════════

  async getProfile(userId: number, _sessionRole?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // When a parent is logged in, the underlying record is a STUDENT — report
    // the session's virtual role instead of the DB role.
    const reportedRole = user.role.toLowerCase();

    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        avatar: user.avatar,
        role: reportedRole,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
    };
  }

  async updateProfile(userId: number, data: UpdateProfileInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    if (data.fullName !== undefined) {
      await Promise.all([
        prisma.studentProfile.updateMany({
          where: { userId },
          data: { fullName: data.fullName },
        }),
        prisma.parentProfile.updateMany({
          where: { userId },
          data: { fullName: data.fullName },
        }),
      ]);
    }

    if (data.phone !== undefined) {
      await prisma.parentProfile.updateMany({
        where: { userId },
        data: { phoneNumber: data.phone || null },
      });
    }

    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updated.id,
        username: updated.username,
        fullName: updated.fullName,
        phone: updated.phone,
        avatar: updated.avatar,
        role: updated.role.toLowerCase(),
      },
    };
  }

  async changePassword(userId: number, data: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 400);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      success: true,
      message: 'Password changed successfully',
      data: null,
    };
  }

  async uploadAvatar(userId: number, file: Express.Multer.File) {
    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    if (!(FILE_UPLOAD.ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new AppError('Only JPG, PNG, and WebP images are allowed', 400);
    }

    if (file.size > FILE_UPLOAD.MAX_AVATAR_SIZE) {
      throw new AppError('File size must not exceed 2MB', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const ext = file.originalname.split('.').pop() || 'jpg';
    const objectName = `avatars/${userId}/${Date.now()}.${ext}`;

    const minioClient = getMinioClient();
    const stream = Readable.from(file.buffer);

    await minioClient.putObject(
      env.minio.bucket,
      objectName,
      stream,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    if (user.avatar) {
      try {
        const oldKey = user.avatar.split(`${env.minio.bucket}/`).pop();
        if (oldKey) {
          await minioClient.removeObject(env.minio.bucket, oldKey);
        }
      } catch {
        // old avatar cleanup is best-effort
      }
    }

    const protocol = env.minio.useSSL ? 'https' : 'http';
    const avatarUrl = `${protocol}://${env.minio.endpoint}:${env.minio.port}/${env.minio.bucket}/${objectName}`;

    await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });

    return {
      success: true,
      message: 'Avatar uploaded successfully',
      data: { avatar: avatarUrl },
    };
  }

  // ═══════════════════════════════════════════════
  // ADMIN — User Management (UC37–39)
  // ═══════════════════════════════════════════════

  async listUsers(query: ListUsersQuery) {
    const page = query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;
    const sortField = query.sort ?? 'createdAt';
    const sortOrder = query.order ?? 'desc';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { username: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          studentProfile: { select: { studentCode: true, parentCode: true, classId: true } },
          parentProfile: { select: { parentCode: true, phoneNumber: true, _count: { select: { children: true } } } },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Users retrieved successfully',
      data: users.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        phone: u.phone,
        avatar: u.avatar,
        role: u.role,
        studentProfile: u.studentProfile,
        parentProfile: u.parentProfile,
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
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
   * Static list — roles are a DB enum now, not a table.
   * Kept for backwards compatibility with the admin UI.
   */
  async adminListRoles() {
    return {
      success: true,
      message: 'Roles retrieved successfully',
      data: [
        { value: 'ADMIN', label: 'Quản trị viên' },
        { value: 'TEACHER', label: 'Giáo viên' },
        { value: 'STUDENT', label: 'Học sinh' },
        { value: 'PARENT', label: 'Phụ huynh' },
      ],
    };
  }

  async adminCreateUser(data: CreateUserInput) {
    if (data.role === 'ADMIN') {
      const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (existingAdmin) {
        throw new AppError('Only one ADMIN account is allowed', 409);
      }
    }

    if (data.role === 'ADMIN' && !data.username) {
      throw new AppError('Username is required for ADMIN accounts', 400);
    }

    const username = data.username?.trim() || buildAccountUsername({
      role: data.role as 'STUDENT' | 'TEACHER' | 'PARENT',
      fullName: data.fullName,
      code: data.accountCode || '',
      className: data.className,
      school: data.school || '',
    });

    const existingUsername = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
    if (existingUsername) {
      throw new AppError('Username already exists', 409);
    }

    if (data.classId) {
      const classEntity = await prisma.class.findUnique({ where: { id: data.classId } });
      if (!classEntity) throw new AppError('Class not found', 404);
    }

    if (data.parentCode) {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { parentCode: data.parentCode },
      });
      if (!parentProfile) throw new AppError('Parent profile not found', 404);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          fullName: data.fullName,
          phone: data.phone || null,
          role: data.role,
          status: 'ACTIVE',
        },
      });

      if (data.role === 'STUDENT') {
        const studentCode = data.accountCode || `student-${user.id}`;
        await tx.studentProfile.create({
          data: {
            studentCode,
            userId: user.id,
            parentCode: data.parentCode || null,
            fullName: data.fullName,
            classId: data.classId || null,
          },
        });

        if (data.classId) {
          await tx.classStudent.createMany({
            data: [{ classId: data.classId, studentId: user.id }],
            skipDuplicates: true,
          });
        }
      }

      if (data.role === 'PARENT') {
        await tx.parentProfile.create({
          data: {
            parentCode: data.accountCode || `parent-${user.id}`,
            userId: user.id,
            phoneNumber: data.phone || null,
            fullName: data.fullName,
          },
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          studentProfile: { select: { studentCode: true, parentCode: true, classId: true } },
          parentProfile: { select: { parentCode: true, phoneNumber: true, _count: { select: { children: true } } } },
        },
      });
    });

    if (!result) {
      throw new AppError('Failed to create user', 500);
    }

    return {
      success: true,
      message: 'User created successfully',
      data: {
        id: result.id,
        username: result.username,
        fullName: result.fullName,
        phone: result.phone,
        role: result.role,
        studentProfile: result.studentProfile,
        parentProfile: result.parentProfile,
        status: result.status,
        createdAt: result.createdAt,
      },
    };
  }

  async adminUpdateUser(userId: number, data: UpdateUserInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.status !== undefined) updateData.status = data.status;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return {
      success: true,
      message: 'User updated successfully',
      data: {
        id: updated.id,
        username: updated.username,
        fullName: updated.fullName,
        phone: updated.phone,
        role: updated.role,
        status: updated.status,
        createdAt: updated.createdAt,
      },
    };
  }

  async adminSoftDeleteUser(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('User is already suspended', 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });

    return {
      success: true,
      message: 'User suspended successfully',
      data: null,
    };
  }

  async adminChangeRole(userId: number, data: ChangeRoleInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (data.role === 'ADMIN') {
      const existingAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN', id: { not: userId } },
      });
      if (existingAdmin) throw new AppError('Only one ADMIN account is allowed', 409);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role: data.role,
      },
    });

    return {
      success: true,
      message: 'User role changed successfully',
      data: {
        id: updated.id,
        username: updated.username,
        role: updated.role,
      },
    };
  }

  async importUsersFromExcel(file: Express.Multer.File) {
    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new AppError('Only Excel files (.xlsx, .xls) are allowed', 400);
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new AppError('Excel file has no sheets', 400);
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]);
    if (!rows.length) {
      throw new AppError('Excel file is empty', 400);
    }

    const validRoles = ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] as const;
    type ImportRole = (typeof validRoles)[number];
    const roleSet = new Set<string>(validRoles);

    const existingUsernames = new Set(
      (await prisma.user.findMany({ select: { username: true } })).map((u: { username: string }) => u.username.toLowerCase()),
    );

    const errors: { row: number; field: string; message: string }[] = [];
    const validUsers: Array<{
      username: string;
      passwordHash: string;
      fullName: string | null;
      phone: string | null;
      role: ImportRole;
      accountCode: string | null;
      parentCode: string | null;
      classId: number | null;
    }> = [];

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    const newUsernames = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // row 1 is header
      let username = String(row.username ?? row.Username ?? '').trim();
      const password = String(row.password ?? row.Password ?? '').trim();
      const fullName = String(row.fullName ?? row.full_name ?? row.FullName ?? '').trim() || null;
      const phone = String(row.phone ?? row.Phone ?? '').trim() || null;
      const roleName = String(row.role ?? row.Role ?? '').trim().toUpperCase();
      const accountCode = String(row.accountCode ?? row.account_code ?? row.code ?? row.Code ?? '').trim() || null;
      const school = String(row.school ?? row.School ?? '').trim();
      const className = String(row.className ?? row.class_name ?? row.class ?? row.Class ?? '').trim();
      const parentCode = String(row.parentCode ?? row.parent_code ?? row.ParentCode ?? '').trim() || null;
      const classIdRaw = String(row.classId ?? row.class_id ?? row.ClassId ?? '').trim();
      const classId = classIdRaw ? Number(classIdRaw) : null;

      let hasError = false;

      if (!username && roleSet.has(roleName)) {
        if (!fullName || !accountCode || !school || (roleName !== 'PARENT' && !className)) {
          errors.push({ row: rowNum, field: 'username', message: 'Username is required unless fullName, accountCode, school, and className are provided for generation' });
          hasError = true;
        } else {
          username = buildAccountUsername({
            role: roleName as 'STUDENT' | 'TEACHER' | 'PARENT',
            fullName,
            code: accountCode,
            school,
            className,
          });
        }
      }

      if (!username || username.length < 3 || username.length > 191) {
        errors.push({ row: rowNum, field: 'username', message: 'Username must be 3–50 characters' });
        hasError = true;
      } else if (existingUsernames.has(username.toLowerCase()) || newUsernames.has(username.toLowerCase())) {
        errors.push({ row: rowNum, field: 'username', message: `Username "${username}" already exists` });
        hasError = true;
      }

      if (!password || !passwordRegex.test(password)) {
        errors.push({ row: rowNum, field: 'password', message: 'Password must be 8+ chars with upper, lower, and number' });
        hasError = true;
      }

      if (!roleSet.has(roleName)) {
        errors.push({ row: rowNum, field: 'role', message: `Invalid role "${roleName}". Valid: ${validRoles.join(', ')}` });
        hasError = true;
      }

      if (!fullName) {
        errors.push({ row: rowNum, field: 'fullName', message: 'Full name is required' });
        hasError = true;
      }

      if (classIdRaw && (!Number.isInteger(classId) || Number(classId) <= 0)) {
        errors.push({ row: rowNum, field: 'classId', message: 'classId must be a positive integer' });
        hasError = true;
      }

      if (!hasError) {
        const passwordHash = await bcrypt.hash(password, 12);
        validUsers.push({
          username,
          passwordHash,
          fullName,
          phone,
          role: roleName as ImportRole,
          accountCode,
          parentCode,
          classId,
        });
        newUsernames.add(username.toLowerCase());
      }
    }

    let createdCount = 0;
    if (validUsers.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const row of validUsers) {
          const user = await tx.user.create({
            data: {
              username: row.username,
              passwordHash: row.passwordHash,
              fullName: row.fullName,
              phone: row.phone,
              role: row.role,
              status: 'ACTIVE',
            },
          });

          if (row.role === 'STUDENT') {
            await tx.studentProfile.create({
              data: {
                studentCode: row.accountCode || `student-${user.id}`,
                userId: user.id,
                parentCode: row.parentCode,
                fullName: row.fullName || row.username,
                classId: row.classId,
              },
            });
            if (row.classId) {
              await tx.classStudent.createMany({
                data: [{ classId: row.classId, studentId: user.id }],
                skipDuplicates: true,
              });
            }
          } else if (row.role === 'PARENT') {
            await tx.parentProfile.create({
              data: {
                parentCode: row.accountCode || `parent-${user.id}`,
                userId: user.id,
                phoneNumber: row.phone,
                fullName: row.fullName || row.username,
              },
            });
          }

          createdCount++;
        }
      });
    }

    logger.info(`User import: ${createdCount} created, ${errors.length} errors from ${rows.length} rows`);

    return {
      success: true,
      message: `Import completed: ${createdCount} users created, ${errors.length} errors`,
      data: {
        totalRows: rows.length,
        created: createdCount,
        imported: createdCount,
        errorCount: errors.length,
        errors: errors.slice(0, 100),
      },
    };
  }

  getImportTemplate() {
    const templateData = [
      { username: '', password: 'Pass1234', fullName: 'Nguyen Van A', phone: '0901234567', role: 'STUDENT', accountCode: 'HS001', className: '10A1', school: 'webquiz', parentCode: 'PH001', classId: '' },
      { username: '', password: 'Pass1234', fullName: 'Tran Thi B', phone: '0912345678', role: 'TEACHER', accountCode: 'GV001', className: '10A1', school: 'webquiz', parentCode: '', classId: '' },
      { username: '', password: 'Pass1234', fullName: 'Le Thi C', phone: '0934567890', role: 'PARENT', accountCode: 'PH001', className: '', school: 'webquiz', parentCode: '', classId: '' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    const colWidths = [
      { wch: 15 }, // username
      { wch: 15 }, // password
      { wch: 25 }, // fullName
      { wch: 15 }, // phone
      { wch: 10 }, // role
      { wch: 15 }, // accountCode
      { wch: 12 }, // className
      { wch: 15 }, // school
      { wch: 15 }, // parentCode
      { wch: 10 }, // classId
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}

export const userService = new UserService();
