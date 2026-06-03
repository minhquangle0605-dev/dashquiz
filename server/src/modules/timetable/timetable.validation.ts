import { z } from 'zod';

// ═══════════════════════════════════════════════
// CREATE TIMETABLE SLOT
// ═══════════════════════════════════════════════

export const createSlotSchema = z
  .object({
    displayName: z.string().min(1, 'Display name is required').max(100),
    // When omitted, the slot kind is derived from displayName (managed subject
    // names → MANAGED_SUBJECT, otherwise DISPLAY_ONLY).
    subjectId: z.coerce.number().int().positive().optional().nullable(),
    semesterId: z.coerce.number().int().positive().optional().nullable(),
    dayOfWeek: z.coerce.number().int().min(1, 'Day must be 1–7 (Mon–Sun)').max(7),
    periodIndex: z.coerce.number().int().min(1).max(12),
    startMinute: z.coerce.number().int().min(0).max(1439),
    endMinute: z.coerce.number().int().min(1).max(1440),
    room: z.string().max(50).optional().nullable(),
    note: z.string().max(255).optional().nullable(),
  })
  .refine((d) => d.endMinute > d.startMinute, {
    message: 'End time must be after start time',
    path: ['endMinute'],
  });

// ═══════════════════════════════════════════════
// UPDATE TIMETABLE SLOT (partial)
// ═══════════════════════════════════════════════

export const updateSlotSchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    subjectId: z.coerce.number().int().positive().optional().nullable(),
    semesterId: z.coerce.number().int().positive().optional().nullable(),
    dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
    periodIndex: z.coerce.number().int().min(1).max(12).optional(),
    startMinute: z.coerce.number().int().min(0).max(1439).optional(),
    endMinute: z.coerce.number().int().min(1).max(1440).optional(),
    room: z.string().max(50).optional().nullable(),
    note: z.string().max(255).optional().nullable(),
    status: z.enum(['ACTIVE', 'CANCELLED']).optional(),
  })
  .refine(
    (d) => d.startMinute === undefined || d.endMinute === undefined || d.endMinute > d.startMinute,
    { message: 'End time must be after start time', path: ['endMinute'] },
  );

// ═══════════════════════════════════════════════
// CHECK EXAM-SCHEDULE CONFLICTS
// ═══════════════════════════════════════════════

export const checkConflictsSchema = z
  .object({
    classIds: z
      .array(z.coerce.number().int().positive())
      .min(1, 'At least one class is required'),
    subjectId: z.coerce.number().int().positive().optional().nullable(),
    startTime: z.coerce.date({ message: 'Start time is required' }),
    endTime: z.coerce.date({ message: 'End time is required' }),
    excludeExamId: z.coerce.number().int().positive().optional().nullable(),
    room: z.string().max(50).optional().nullable(),
    proctorId: z.coerce.number().int().positive().optional().nullable(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

// ═══════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
export type CheckConflictsInput = z.infer<typeof checkConflictsSchema>;
