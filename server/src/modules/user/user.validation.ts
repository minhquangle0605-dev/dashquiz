/**
 * Planned Zod schemas (user module):
 * - updateProfileBodySchema — displayName, phone, avatarUrl, preferences
 * - listUsersQuerySchema — page, limit, role, search, classId
 * - createUserBodySchema — email, password, role, profile
 * - updateUserBodySchema — partial profile + role
 * - userIdParamSchema — id (uuid/cuid)
 * - linkParentBodySchema — parentId, studentIds[]
 * - importUsersMultipart — file field name, max size (validated with middleware + Zod passthrough)
 */

export const userSchemas = {} as const;
