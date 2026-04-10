import { z } from 'zod';

const passwordComplexity = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Invalid email address');

export const passwordSchema = passwordComplexity;

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(191, 'Username is too long'),
  password: z.string().min(1, 'Password is required'),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(200),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .or(z.literal('')),
});

export type EmailInput = z.infer<typeof emailSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type ProfileFormValues = z.infer<typeof profileSchema>;
