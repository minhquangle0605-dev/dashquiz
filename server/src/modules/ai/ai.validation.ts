import { z } from 'zod';

export const generateMatchingDistractorSchema = z.object({
  pairs: z
    .array(
      z.object({
        left: z.string().trim().min(1, 'Left side is required'),
        right: z.string().trim().min(1, 'Right side is required'),
      }),
    )
    .min(2, 'Need at least 2 pairs to generate a distractor')
    .max(20, 'Too many pairs'),
  questionContent: z.string().trim().max(2000).optional(),
  subjectName: z.string().trim().max(120).optional(),
});

export type GenerateMatchingDistractorInput = z.infer<
  typeof generateMatchingDistractorSchema
>;
