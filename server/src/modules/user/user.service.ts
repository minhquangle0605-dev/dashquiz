import bcrypt from 'bcryptjs';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/database';
import { getMinioClient } from '../../config/minio';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { FILE_UPLOAD, PAGINATION } from '../../utils/constants';
import { logger } from '../../utils/logger';
import type {
  UpdateProfileInput,
  ChangePasswordInput,
  ListUsersQuery,
  CreateUserInput,
  UpdateUserInput,
  ChangeRoleInput,
  SetParentPasswordInput,
} from './user.validation';

export class UserService {
  // ═══════════════════════════════════════════════
  // USER SELF-SERVICE
  // ═══════════════════════════════════════════════

  async getProfile(userId: number, sessionRole?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // When a parent is logged in, the underlying record is a STUDENT — report
    // the session's virtual role instead of the DB role.
    const reportedRole = sessionRole === 'parent' ? 'parent' : user.role.toLowerCase();

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
        hasParentLogin: u.parentPasswordHash !== null,
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
        { value: 'STUDENT', label: 'Học sinh (dual-login: kèm mật khẩu phụ huynh)' },
      ],
    };
  }

  async adminCreateUser(data: CreateUserInput) {
    const existingUsername = await prisma.user.findUnique({ where: { username: data.username } });
    if (existingUsername) {
      throw new AppError('Username already exists', 409);
    }

    if (data.parentPassword && data.role !== 'STUDENT') {
      throw new AppError('parentPassword is only valid for STUDENT role', 400);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const parentPasswordHash = data.parentPassword
      ? await bcrypt.hash(data.parentPassword, salt)
      : null;

    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        parentPasswordHash,
        fullName: data.fullName || null,
        phone: null,
        role: data.role,
        status: 'ACTIVE',
      },
    });

    return {
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        hasParentLogin: user.parentPasswordHash !== null,
        status: user.status,
        createdAt: user.createdAt,
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

  /**
   * Set or clear the parent password on a STUDENT account.
   * Passing parentPassword: null clears the parent login entirely.
   */
  async adminSetParentPassword(userId: number, data: SetParentPasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.role !== 'STUDENT') {
      throw new AppError('Parent password is only valid for STUDENT accounts', 400);
    }

    const parentPasswordHash = data.parentPassword
      ? await bcrypt.hash(data.parentPassword, 12)
      : null;

    await prisma.user.update({
      where: { id: userId },
      data: { parentPasswordHash },
    });

    return {
      success: true,
      message: data.parentPassword ? 'Parent password set' : 'Parent password cleared',
      data: { hasParentLogin: parentPasswordHash !== null },
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

    // Switching away from STUDENT clears any leftover parent password so
    // a non-student can't accidentally retain a parent login.
    const clearParent = user.role === 'STUDENT' && data.role !== 'STUDENT';

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role: data.role,
        ...(clearParent ? { parentPasswordHash: null } : {}),
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

    const validRoles = ['ADMIN', 'TEACHER', 'STUDENT'] as const;
    type ImportRole = (typeof validRoles)[number];
    const roleSet = new Set<string>(validRoles);

    const existingUsernames = new Set(
      (await prisma.user.findMany({ select: { username: true } })).map((u: { username: string }) => u.username.toLowerCase()),
    );

    const errors: { row: number; field: string; message: string }[] = [];
    const validUsers: Array<{
      username: string;
      passwordHash: string;
      parentPasswordHash: string | null;
      fullName: string | null;
      phone: string | null;
      role: ImportRole;
    }> = [];

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    const newUsernames = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // row 1 is header
      const username = String(row.username ?? row.Username ?? '').trim();
      const password = String(row.password ?? row.Password ?? '').trim();
      const parentPassword = String(row.parentPassword ?? row.parent_password ?? row.ParentPassword ?? '').trim();
      const fullName = String(row.fullName ?? row.full_name ?? row.FullName ?? '').trim() || null;
      const phone = String(row.phone ?? row.Phone ?? '').trim() || null;
      const roleName = String(row.role ?? row.Role ?? '').trim().toUpperCase();

      let hasError = false;

      if (!username || username.length < 3 || username.length > 50) {
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

      if (parentPassword && roleName !== 'STUDENT') {
        errors.push({ row: rowNum, field: 'parentPassword', message: 'parentPassword is only valid when role=STUDENT' });
        hasError = true;
      }

      if (!hasError) {
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);
        const parentPasswordHash = parentPassword ? await bcrypt.hash(parentPassword, salt) : null;
        validUsers.push({
          username,
          passwordHash,
          parentPasswordHash,
          fullName,
          phone,
          role: roleName as ImportRole,
        });
        newUsernames.add(username.toLowerCase());
      }
    }

    let createdCount = 0;
    if (validUsers.length > 0) {
      const result = await prisma.user.createMany({
        data: validUsers,
        skipDuplicates: true,
      });
      createdCount = result.count;
    }

    logger.info(`User import: ${createdCount} created, ${errors.length} errors from ${rows.length} rows`);

    return {
      success: true,
      message: `Import completed: ${createdCount} users created, ${errors.length} errors`,
      data: {
        totalRows: rows.length,
        created: createdCount,
        errorCount: errors.length,
        errors: errors.slice(0, 100),
      },
    };
  }

  getImportTemplate() {
    const templateData = [
      { username: 'student01', password: 'Pass1234', parentPassword: 'Parent1234', fullName: 'Nguyen Van A', phone: '0901234567', role: 'STUDENT' },
      { username: 'student02', password: 'Pass1234', parentPassword: '', fullName: 'Pham Thi D', phone: '0934567890', role: 'STUDENT' },
      { username: 'teacher01', password: 'Pass1234', parentPassword: '', fullName: 'Tran Thi B', phone: '0912345678', role: 'TEACHER' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    const colWidths = [
      { wch: 15 }, // username
      { wch: 15 }, // password
      { wch: 17 }, // parentPassword
      { wch: 25 }, // fullName
      { wch: 15 }, // phone
      { wch: 10 }, // role
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}

export const userService = new UserService();
