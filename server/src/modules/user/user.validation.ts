import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters')
    .optional(),
  phone: z
    .string()
    .max(20, 'Phone must not exceed 20 characters')
    .optional()
    .nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ error: 'Current password is required' })
    .min(1, 'Current password cannot be empty'),
  newPassword: z
    .string({ error: 'New password is required' })
    .min(6, 'New password must be at least 6 characters')
    .max(100, 'New password must not exceed 100 characters'),
  confirmPassword: z
    .string({ error: 'Confirm password is required' }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const userRoleSchema = z.enum(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  sort: z.enum(['createdAt', 'fullName', 'username', 'status']).default('createdAt').optional(),
  order: z.enum(['asc', 'desc']).default('desc').optional(),
  search: z.string().max(100).optional(),
  role: userRoleSchema.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(191, 'Username must not exceed 191 characters')
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'Username can only contain letters, numbers, dots, underscores, and hyphens',
    )
    .optional(),
  accountCode: z
    .string()
    .min(1, 'Account code is required')
    .max(50, 'Account code must not exceed 50 characters')
    .optional(),
  school: z
    .string()
    .min(1, 'School is required')
    .max(100, 'School must not exceed 100 characters')
    .optional(),
  className: z
    .string()
    .min(1, 'Class is required')
    .max(50, 'Class must not exceed 50 characters')
    .optional(),
  classId: z.coerce.number().int().positive().optional(),
  parentCode: z
    .string()
    .min(1, 'Parent code cannot be empty')
    .max(50, 'Parent code must not exceed 50 characters')
    .optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(passwordRegex, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters'),
  phone: z
    .string()
    .max(20, 'Phone must not exceed 20 characters')
    .optional()
    .nullable(),
  role: userRoleSchema,
}).refine((data) => data.role !== 'ADMIN' || data.username, {
  message: 'Username is required for ADMIN accounts',
  path: ['username'],
}).refine((data) => data.role === 'ADMIN' || data.username || data.accountCode, {
  message: 'Provide username, or provide accountCode to generate an account ID',
  path: ['username'],
}).refine((data) => data.role !== 'STUDENT' || data.accountCode, {
  message: 'accountCode is required for STUDENT IDs',
  path: ['accountCode'],
}).refine((data) => data.role !== 'STUDENT' || data.classId || data.className, {
  message: 'className or classId is required to generate STUDENT IDs',
  path: ['className'],
}).refine((data) => data.role !== 'TEACHER' || data.accountCode, {
  message: 'accountCode is required for TEACHER IDs',
  path: ['accountCode'],
}).refine((data) => data.role !== 'PARENT' || data.accountCode, {
  message: 'Student ID is required for PARENT IDs',
  path: ['accountCode'],
});

export const updateUserSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters')
    .optional(),
  phone: z
    .string()
    .max(20, 'Phone must not exceed 20 characters')
    .optional()
    .nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export const changeRoleSchema = z.object({
  role: userRoleSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type UserRoleValue = z.infer<typeof userRoleSchema>;
