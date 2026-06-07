import { z } from 'zod';

export const studentDashboardQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
});

export const studentPatternsQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
});

export const studentAttemptsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  subjectId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['date', 'score']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const classIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const examIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const classDashboardQuerySchema = z.object({
  semesterId: z.coerce.number().int().positive().optional(),
});

export const classPerformanceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const weakStudentsQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(10).default(5),
  consecutiveExams: z.coerce.number().int().min(1).max(10).default(3),
});

export const compareClassesQuerySchema = z.object({
  classIds: z.string().transform((val) =>
    val
      .split(',')
      .map((v) => parseInt(v.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0),
  ),
  subjectId: z.coerce.number().int().positive().optional(),
});

export const examResultsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'score', 'time']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const exportReportBodySchema = z.object({
  format: z.enum(['pdf', 'excel']),
  reportType: z.enum([
    'class_results',
    'exam_results',
    'student_progress',
    'exam_summary',
    'question_analysis',
    'student_results',
  ]),
  classId: z.number().int().positive().optional(),
  examId: z.number().int().positive().optional(),
  title: z.string().max(200).optional(),
});

export const exportDownloadParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
