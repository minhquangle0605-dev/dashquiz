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

// ─── Package B: relations + learning path ──────────────
const relationTypeSchema = z.enum([
  'PART_OF',
  'PREREQUISITE_OF',
  'RELATED_TO',
  'MISCONCEPTION_FOR',
]);

/** Student: ?targetNodeId= for the prerequisite learning path. */
export const learningPathQuerySchema = z.object({
  targetNodeId: z.coerce.number().int().positive(),
});

/** Admin: ?nodeId=&relationType= filter for listing relations. */
export const listRelationsQuerySchema = z.object({
  nodeId: z.coerce.number().int().positive().optional(),
  relationType: relationTypeSchema.optional(),
});

/** Admin: create a knowledge relation edge. */
export const createRelationBodySchema = z.object({
  fromNodeId: z.number().int().positive(),
  toNodeId: z.number().int().positive(),
  relationType: relationTypeSchema,
  weight: z.number().min(0).max(10).optional(),
  note: z.string().max(300).nullable().optional(),
});

// ─── Package C: governance ─────────────────────────
/** Admin: add an alias/synonym to a node. */
export const addAliasBodySchema = z.object({
  alias: z.string().min(1).max(200),
});

/** Admin: merge one node into another. */
export const mergeNodeBodySchema = z.object({
  targetNodeId: z.number().int().positive(),
});

// ─── Package D: practice sets ──────────────────────
/** Student/teacher: generate a practice set from a node. */
export const practiceBodySchema = z.object({
  nodeId: z.number().int().positive(),
  questionCount: z.number().int().min(1).max(50).optional(),
});
