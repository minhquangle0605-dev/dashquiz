import { z } from 'zod';

// ═══════════════════════════════════════════════
// OPTION SUB-SCHEMA
// ═══════════════════════════════════════════════

const QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'MATCHING',
] as const;

const questionOptionSchema = z.object({
  label: z
    .string()
    .length(1, 'Label must be a single character')
    .regex(/^[A-Z]$/, 'Label must be A-Z'),
  content: z.string().min(1, 'Option content is required'),
  isCorrect: z.boolean(),
});

function validateQuestionShape(
  value: {
    questionType?: (typeof QUESTION_TYPES)[number];
    options?: Array<{ label: string; content: string; isCorrect: boolean }>;
  },
  ctx: z.RefinementCtx,
): void {
  if (!value.options) return;

  const questionType = value.questionType ?? 'SINGLE_CHOICE';
  const options = value.options;
  const correctCount = options.filter((o) => o.isCorrect).length;
  const labels = options.map((o) => o.label.toUpperCase());
  const duplicateLabels = labels.filter((label, index) => labels.indexOf(label) !== index);

  if (duplicateLabels.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Option labels must be unique',
    });
  }

  if (questionType === 'SINGLE_CHOICE') {
    if (options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Single choice questions need at least 2 options',
      });
    }
    if (correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Exactly one option must be marked correct',
      });
    }
  }

  if (questionType === 'TRUE_FALSE') {
    if (options.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'True/False questions must have exactly 2 options',
      });
    }
    if (correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'True/False questions need exactly one correct answer',
      });
    }
  }

  if (questionType === 'MULTIPLE_CHOICE' && correctCount < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Multiple choice questions need at least one correct option',
    });
  }

  if (questionType === 'SHORT_ANSWER') {
    if (options.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Short answer questions need at least one accepted answer',
      });
    }
    if (correctCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Short answer accepted answers must be marked correct',
      });
    }
  }

  if (questionType === 'MATCHING' && options.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Matching questions need at least 2 pairs',
    });
  }
}

// ═══════════════════════════════════════════════
// CREATE QUESTION
// ═══════════════════════════════════════════════

export const createQuestionSchema = z.object({
  subjectId: z.coerce.number().int().positive('Subject is required'),
  chapterId: z.coerce.number().int().positive('Chapter is required'),
  content: z.string().min(1, 'Question content is required'),
  questionType: z.enum(QUESTION_TYPES).default('SINGLE_CHOICE'),
  difficulty: z.coerce.number().int().min(1, 'Difficulty min is 1').max(5, 'Difficulty max is 5'),
  explanation: z.string().optional().nullable(),
  options: z
    .array(questionOptionSchema)
    .min(1, 'At least one answer/option is required')
    .max(26, 'A question can have at most 26 options/answers'),
}).superRefine(validateQuestionShape);

// ═══════════════════════════════════════════════
// UPDATE QUESTION
// ═══════════════════════════════════════════════

export const updateQuestionSchema = z.object({
  content: z.string().min(1, 'Question content cannot be empty').optional(),
  questionType: z.enum(QUESTION_TYPES).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  explanation: z.string().optional().nullable(),
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  options: z
    .array(questionOptionSchema)
    .min(1, 'At least one answer/option is required')
    .max(26, 'A question can have at most 26 options/answers')
    .optional(),
}).superRefine(validateQuestionShape);

// ═══════════════════════════════════════════════
// LIST QUESTIONS (QUERY PARAMS)
// ═══════════════════════════════════════════════

export const listQuestionsQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  gradeLevel: z.coerce.number().int().min(10).max(12).optional(),
  chapterId: z.coerce.number().int().positive().optional(),
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
  questionType: z.enum(QUESTION_TYPES).optional(),
  keyword: z.string().max(200).optional(),
  reviewStatus: z
    .enum(['needs_review', 'needs_revision', 'approved', 'good', 'rejected'])
    .optional(),
  tag: z.string().max(50).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ═══════════════════════════════════════════════
// BULK UPDATE (set difficulty / review status for many)
// ═══════════════════════════════════════════════

export const bulkUpdateSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1, 'At least one question is required'),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  reviewStatus: z
    .enum(['needs_review', 'needs_revision', 'approved', 'good', 'rejected'])
    .optional(),
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
});

// ═══════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;
export type AddTagsInput = z.infer<typeof addTagsSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
export type ImportQuestionsInput = z.infer<typeof importQuestionsSchema>;
