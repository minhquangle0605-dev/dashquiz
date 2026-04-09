/**
 * Planned Zod schemas (auth module):
 * - loginBodySchema — email, password
 * - refreshBodySchema — refreshToken
 * - forgotPasswordBodySchema — email
 * - resetPasswordBodySchema — token, newPassword, confirmPassword
 * - registerBodySchema (if applicable) — email, password, role, profile fields
 * - changePasswordBodySchema — currentPassword, newPassword
 *
 * Wire with a validation middleware (e.g. parse req.body) in Phase 2+.
 */

export const authSchemas = {} as const;
