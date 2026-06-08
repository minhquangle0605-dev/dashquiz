import { z } from 'zod';

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

export const childLearningPathQuerySchema = z.object({
  targetNodeId: z.coerce.number().int().positive(),
});

export type ChildLearningPathQuery = z.infer<typeof childLearningPathQuerySchema>;
