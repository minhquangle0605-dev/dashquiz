import { z } from 'zod';

export const createSubjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Subject name is required')
    .max(50, 'Subject name must not exceed 50 characters'),
  code: z
    .string()
    .min(1, 'Subject code is required')
    .max(10, 'Subject code must not exceed 10 characters')
    .regex(/^[A-Z0-9_]+$/i, 'Subject code can only contain letters, numbers, and underscores'),
  description: z.string().max(1000).optional().nullable(),
});

export const updateSubjectSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50, 'Subject name must not exceed 50 characters')
    .optional(),
  code: z
    .string()
    .min(1)
    .max(10, 'Subject code must not exceed 10 characters')
    .regex(/^[A-Z0-9_]+$/i, 'Subject code can only contain letters, numbers, and underscores')
    .optional(),
  description: z.string().max(1000).optional().nullable(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

export const createAcademicYearSchema = z.object({
  name: z
    .string()
    .min(1, 'Academic year name is required')
    .max(20, 'Academic year name must not exceed 20 characters'),
  startDate: z.coerce.date({ message: 'Start date is required' }),
  endDate: z.coerce.date({ message: 'End date is required' }),
  isCurrent: z.boolean().default(false).optional(),
}).refine((data) => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updateAcademicYearSchema = z.object({
  name: z.string().min(1).max(20).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isCurrent: z.boolean().optional(),
});

export const listSemestersQuerySchema = z.object({
  academicYearId: z.coerce.number().int().positive().optional(),
});

export const createSemesterSchema = z.object({
  academicYearId: z.coerce.number().int().positive({ message: 'Academic year is required' }),
  name: z
    .string()
    .min(1, 'Semester name is required')
    .max(20, 'Semester name must not exceed 20 characters'),
  startDate: z.coerce.date({ message: 'Start date is required' }),
  endDate: z.coerce.date({ message: 'End date is required' }),
}).refine((data) => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updateSemesterSchema = z.object({
  academicYearId: z.coerce.number().int().positive().optional(),
  name: z.string().min(1).max(20).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
export type ListSemestersQuery = z.infer<typeof listSemestersQuerySchema>;
export type CreateSemesterInput = z.infer<typeof createSemesterSchema>;
export type UpdateSemesterInput = z.infer<typeof updateSemesterSchema>;
