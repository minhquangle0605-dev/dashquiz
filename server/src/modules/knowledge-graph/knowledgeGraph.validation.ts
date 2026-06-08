import { z } from 'zod';

/** Optional ?subjectId= filter shared by student + teacher graph endpoints. */
export const subjectQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
});

/** Admin: edit a knowledge node's display fields (mappings stay auto-generated). */
export const updateNodeBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    orderIndex: z.number().int().min(0).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });
