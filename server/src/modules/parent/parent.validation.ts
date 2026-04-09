import { z } from 'zod';

export const linkStudentBodySchema = z.object({
  code: z
    .string()
    .min(6, 'Link code must be 6 characters')
    .max(6, 'Link code must be 6 characters')
    .regex(/^[A-Z0-9]{6}$/, 'Link code must be 6 uppercase alphanumeric characters'),
  relationship: z
    .string()
    .max(20)
    .optional()
    .default('parent'),
});

export type LinkStudentInput = z.infer<typeof linkStudentBodySchema>;

export const generateLinkCodeParamsSchema = z.object({
  studentId: z.coerce.number().int().positive(),
});

export const childIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const childResultsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  subjectId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.enum(['date', 'score']).optional().default('date'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ChildResultsQuery = z.infer<typeof childResultsQuerySchema>;

export const childAnalyticsQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
});

export type ChildAnalyticsQuery = z.infer<typeof childAnalyticsQuerySchema>;
