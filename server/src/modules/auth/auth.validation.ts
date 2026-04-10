import { z } from 'zod';

const usernameField = z
  .string({ error: 'Username is required' })
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(191, 'Username is too long');

export const loginSchema = z.object({
  username: usernameField,
  password: z
    .string({ error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
