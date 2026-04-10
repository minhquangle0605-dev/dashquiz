/**
 * Username helpers for role-based identifiers like:
 * name.code.school.teacher | .student | .parent
 *
 * Normalization approach aligns with common slug patterns (ASCII, separators).
 * References:
 * - Prisma case-insensitive lookup: https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#case-insensitive-filtering
 * - Unicode NFD normalization (remove diacritics): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
 */

const ROLE_SUFFIXES = ['teacher', 'student', 'parent'] as const;
export type RoleUsernameSuffix = (typeof ROLE_SUFFIXES)[number];

function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Lowercase segment: letters, digits, dot and underscore allowed inside segments (dots separate segments). */
export function slugifySegment(raw: string): string {
  const ascii = stripDiacritics(raw.trim())
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '');
  return ascii.replace(/^\.+|\.+$/g, '');
}

export function assertValidRoleSuffix(suffix: string): asserts suffix is RoleUsernameSuffix {
  if (!ROLE_SUFFIXES.includes(suffix as RoleUsernameSuffix)) {
    throw new Error(`Invalid role suffix: ${suffix}. Expected one of: ${ROLE_SUFFIXES.join(', ')}`);
  }
}

/**
 * Build a login username from display parts. Does not check DB uniqueness — caller must ensure uniqueness (e.g. suffix with -2).
 */
export function buildRoleUsername(
  displayName: string,
  code: string,
  schoolSlug: string,
  roleSuffix: RoleUsernameSuffix,
): string {
  const a = slugifySegment(displayName);
  const b = slugifySegment(code);
  const c = slugifySegment(schoolSlug);
  if (!a || !b || !c) {
    throw new Error('Each of name, code, and school must contain at least one letter or digit after normalization');
  }
  return `${a}.${b}.${c}.${roleSuffix}`;
}
