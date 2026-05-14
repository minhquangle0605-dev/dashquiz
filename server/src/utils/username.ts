/**
 * Username helpers for school account identifiers:
 * student/teacher: givenNameMiddleInitials.code.class.school
 * parent: givenNameInitials.parentCode.school
 *
 * References:
 * - Unicode NFD normalization: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
 * - Prisma case-insensitive lookup: https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#case-insensitive-filtering
 */

type AccountRole = 'STUDENT' | 'TEACHER' | 'PARENT';

function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D');
}

/** Lowercase segment: letters, digits, dot and underscore allowed inside segments (dots separate segments). */
export function slugifySegment(raw: string): string {
  const ascii = stripDiacritics(raw.trim())
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '');
  return ascii.replace(/^\.+|\.+$/g, '');
}

function nameParts(fullName: string): string[] {
  return stripDiacritics(fullName)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
}

/**
 * Vietnamese names are commonly ordered family + middle + given. The requested
 * format uses the given name followed by initials from the middle names.
 * For two-part names we still include the first-part initial to avoid weak ids.
 */
export function compactVietnameseName(fullName: string): string {
  const parts = nameParts(fullName);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  const givenName = parts[parts.length - 1];
  const middleStart = parts.length > 2 ? 1 : 0;
  const middle = parts.slice(middleStart, -1).map((part) => part[0]).join('');
  return `${givenName}${middle}`;
}

export function buildAccountUsername(input: {
  role: AccountRole;
  fullName: string;
  code: string;
  school: string;
  className?: string | null;
}): string {
  const name = compactVietnameseName(input.fullName);
  const code = slugifySegment(input.code);
  const school = slugifySegment(input.school);
  const className = input.className ? slugifySegment(input.className) : '';

  if (!name || !code || !school) {
    throw new Error('Name, code, and school must contain at least one letter or digit after normalization');
  }

  if ((input.role === 'STUDENT' || input.role === 'TEACHER') && !className) {
    throw new Error('className is required to generate student or teacher usernames');
  }

  if (input.role === 'PARENT') {
    return `${name}.${code}.${school}`;
  }

  return `${name}.${code}.${className}.${school}`;
}
