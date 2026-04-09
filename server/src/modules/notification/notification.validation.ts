import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  isRead: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('all'),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const markReadParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const pushSubscribeBodySchema = z.object({
  endpoint: z.string().url('Invalid endpoint URL'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh key is required'),
    auth: z.string().min(1, 'auth key is required'),
  }),
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeBodySchema>;

export const pushUnsubscribeBodySchema = z.object({
  endpoint: z.string().url('Invalid endpoint URL'),
});

export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeBodySchema>;
