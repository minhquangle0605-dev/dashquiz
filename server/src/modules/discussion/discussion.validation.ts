import { z } from 'zod';

export const discussionScopeSchema = z.enum(['CLASS', 'GLOBAL']);
export const discussionTypeSchema = z.enum(['ANNOUNCEMENT', 'DISCUSSION']);

const attachmentLinkSchema = z.object({
  url: z.string().url('Link must be a valid URL').max(2000),
  title: z.string().max(255).optional(),
});

const linksSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (!value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, z.array(attachmentLinkSchema).max(10).optional());

export const listDiscussionsQuerySchema = z.object({
  scope: discussionScopeSchema.optional(),
  type: discussionTypeSchema.optional(),
  classId: z.coerce.number().int().positive().optional(),
  search: z.string().max(120).optional(),
  authorId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListDiscussionsQuery = z.infer<typeof listDiscussionsQuerySchema>;

export const createDiscussionSchema = z
  .object({
    scope: discussionScopeSchema,
    type: discussionTypeSchema,
    classId: z.coerce.number().int().positive().optional(),
    title: z.string().min(1, 'Title is required').max(200),
    content: z.string().max(10000).optional().default(''),
    links: linksSchema,
  })
  .refine(
    (val) => (val.scope === 'CLASS' ? val.classId !== undefined : val.classId === undefined),
    { message: 'classId is required for CLASS scope and must be empty for GLOBAL', path: ['classId'] },
  );
export type CreateDiscussionInput = z.infer<typeof createDiscussionSchema>;

export const updateDiscussionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  type: discussionTypeSchema.optional(),
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});
export type UpdateDiscussionInput = z.infer<typeof updateDiscussionSchema>;

export const createReplySchema = z.object({
  content: z.string().max(5000).optional().default(''),
  links: linksSchema,
});
export type CreateReplyInput = z.infer<typeof createReplySchema>;

export const updateReplySchema = z.object({
  content: z.string().min(1).max(5000),
});
export type UpdateReplyInput = z.infer<typeof updateReplySchema>;
