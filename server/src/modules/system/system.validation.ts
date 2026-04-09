import { z } from 'zod';

export const updateConfigsSchema = z.object({
  configs: z.array(
    z.object({
      key: z.string().min(1).max(50),
      value: z.string(),
      description: z.string().max(255).optional(),
    }),
  ).min(1, 'At least one config entry is required'),
});

export const listActivityLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  userId: z.coerce.number().int().positive().optional(),
  action: z.string().max(50).optional(),
  entityType: z.string().max(50).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const listBackupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
});

export type UpdateConfigsInput = z.infer<typeof updateConfigsSchema>;
export type ListActivityLogsQuery = z.infer<typeof listActivityLogsQuerySchema>;
export type ListBackupsQuery = z.infer<typeof listBackupsQuerySchema>;
