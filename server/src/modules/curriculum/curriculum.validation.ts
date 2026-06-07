import { z } from 'zod';

// ═══════════════════════════════════════════════
// CHAPTER
// ═══════════════════════════════════════════════

export const createChapterSchema = z.object({
  subjectId: z.coerce.number().int().positive('Subject is required'),
  gradeLevel: z.coerce.number().int().min(10, 'Grade level 10-12').max(12, 'Grade level 10-12'),
  name: z
    .string()
    .min(1, 'Chapter name is required')
    .max(100, 'Chapter name must not exceed 100 characters'),
  orderIndex: z.coerce.number().int().min(0, 'Order index must be >= 0'),
});

// ═══════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
