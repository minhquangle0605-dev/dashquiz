import { z } from 'zod';

// ═══════════════════════════════════════════════
// OPTION SUB-SCHEMA
// ═══════════════════════════════════════════════

const questionOptionSchema = z.object({
  label: z
    .string()
    .length(1, 'Label must be a single character')
    .regex(/^[A-D]$/, 'Label must be A, B, C, or D'),
  content: z.string().min(1, 'Option content is required'),
  isCorrect: z.boolean(),
});

// ═══════════════════════════════════════════════
// CREATE QUESTION
// ═══════════════════════════════════════════════

export const createQuestionSchema = z.object({
  subjectId: z.coerce.number().int().positive('Subject is required'),
  chapterId: z.coerce.number().int().positive('Chapter is required'),
  topicId: z.coerce.number().int().positive('Topic is required'),
  content: z.string().min(1, 'Question content is required'),
  questionType: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']).default('SINGLE_CHOICE'),
  difficulty: z.coerce.number().int().min(1, 'Difficulty min is 1').max(5, 'Difficulty max is 5'),
  explanation: z.string().optional().nullable(),
  options: z
    .array(questionOptionSchema)
    .length(4, 'Exactly 4 options (A, B, C, D) are required')
    .refine((opts) => opts.some((o) => o.isCorrect), {
      message: 'At least one option must be marked as correct',
    }),
});

// ═══════════════════════════════════════════════
// UPDATE QUESTION
// ═══════════════════════════════════════════════

export const updateQuestionSchema = z.object({
  content: z.string().min(1, 'Question content cannot be empty').optional(),
  questionType: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  explanation: z.string().optional().nullable(),
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  topicId: z.coerce.number().int().positive().optional(),
  options: z
    .array(questionOptionSchema)
    .length(4, 'Exactly 4 options required')
    .refine((opts) => opts.some((o) => o.isCorrect), {
      message: 'At least one option must be marked as correct',
    })
    .optional(),
});

// ═══════════════════════════════════════════════
// LIST QUESTIONS (QUERY PARAMS)
// ═══════════════════════════════════════════════

export const listQuestionsQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  topicId: z.coerce.number().int().positive().optional(),
  difficulty: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return val
        .split(',')
        .map(Number)
        .filter((n) => !isNaN(n) && n >= 1 && n <= 5);
    }),
  keyword: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ═══════════════════════════════════════════════
// TAGS
// ═══════════════════════════════════════════════

export const addTagsSchema = z.object({
  tags: z
    .array(z.string().min(1, 'Tag cannot be empty').max(50, 'Tag max 50 chars'))
    .min(1, 'At least one tag is required'),
});

// ═══════════════════════════════════════════════
// IMPORT EXCEL (form fields alongside file)
// ═══════════════════════════════════════════════

export const importQuestionsSchema = z.object({
  subjectId: z.coerce.number().int().positive('Subject is required'),
  chapterId: z.coerce.number().int().positive('Chapter is required'),
  topicId: z.coerce.number().int().positive('Topic is required'),
});

// ═══════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;
export type AddTagsInput = z.infer<typeof addTagsSchema>;
export type ImportQuestionsInput = z.infer<typeof importQuestionsSchema>;
