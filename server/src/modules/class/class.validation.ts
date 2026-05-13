import { z } from 'zod';

// ═══════════════════════════════════════════════
// CREATE CLASS
// ═══════════════════════════════════════════════

export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required').max(20),
  gradeLevel: z.coerce.number().int().min(10, 'Grade level 10-12').max(12, 'Grade level 10-12'),
  semesterId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive('Subject is required'),
  academicYearString: z.string().optional(),
});

// ═══════════════════════════════════════════════
// UPDATE CLASS
// ═══════════════════════════════════════════════

export const updateClassSchema = z.object({
  name: z.string().min(1).max(20).optional(),
  gradeLevel: z.coerce.number().int().min(10).max(12).optional(),
  semesterId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  academicYearString: z.string().optional(),
});

// ═══════════════════════════════════════════════
// ADD STUDENTS
// ═══════════════════════════════════════════════

export const addStudentsSchema = z.object({
  userIds: z
    .array(z.coerce.number().int().positive())
    .min(1, 'At least one student ID is required'),
});

// ═══════════════════════════════════════════════
// LIST CLASSES QUERY
// ═══════════════════════════════════════════════

export const listClassesQuerySchema = z.object({
  semesterId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  gradeLevel: z.coerce.number().int().min(10).max(12).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ═══════════════════════════════════════════════
// LIST STUDENTS QUERY
// ═══════════════════════════════════════════════

export const listStudentsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// ═══════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type AddStudentsInput = z.infer<typeof addStudentsSchema>;
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
