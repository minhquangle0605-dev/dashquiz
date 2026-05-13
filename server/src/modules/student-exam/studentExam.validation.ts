import { z } from 'zod';

export const listStudentExamsQuerySchema = z.object({
  filter: z.enum(['upcoming', 'in_progress', 'completed', 'all']).default('all'),
  subjectId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const startExamSchema = z.object({}).optional();

const answerValueSchema = z.union([
  z.number().int().positive(),
  z.array(z.number().int().positive()),
  z.string(),
  z.record(z.string(), z.string()),
  z.null(),
]);

export const saveAnswersSchema = z.object({
  answers: z.record(
    z.string().regex(/^\d+$/, 'Question ID must be numeric'),
    answerValueSchema,
  ),
});

export const submitAttemptSchema = z.object({
  answers: z
    .record(
      z.string().regex(/^\d+$/, 'Question ID must be numeric'),
      answerValueSchema,
    )
    .optional(),
});

export const listAttemptsQuerySchema = z.object({
  examId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type ListStudentExamsQuery = z.infer<typeof listStudentExamsQuerySchema>;
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>;
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type ListAttemptsQuery = z.infer<typeof listAttemptsQuerySchema>;
