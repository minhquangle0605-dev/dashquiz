import { z } from 'zod';

// ═══════════════════════════════════════════════
// CHAPTER
// ═══════════════════════════════════════════════

export const createChapterSchema = z.object({
  subjectId: z.coerce.number().int().positive('Subject is required'),
  name: z
    .string()
    .min(1, 'Chapter name is required')
    .max(100, 'Chapter name must not exceed 100 characters'),
  orderIndex: z.coerce.number().int().min(0, 'Order index must be >= 0'),
});

// ═══════════════════════════════════════════════
// TOPIC
// ═══════════════════════════════════════════════

export const createTopicSchema = z.object({
  chapterId: z.coerce.number().int().positive('Chapter is required'),
  name: z
    .string()
    .min(1, 'Topic name is required')
    .max(100, 'Topic name must not exceed 100 characters'),
  description: z.string().max(2000).optional().nullable(),
});

// ═══════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
