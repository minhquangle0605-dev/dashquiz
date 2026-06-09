type StudentGrade = 10 | 11 | 12;

function normalizeSuffix(raw: string): string {
  const suffix = raw.trim();
  if (!suffix) {
    throw new Error('Account code is required');
  }

  if (!/^[a-zA-Z0-9]+$/.test(suffix)) {
    throw new Error('Account code can only contain letters and numbers');
  }

  return /^\d+$/.test(suffix) ? suffix.padStart(3, '0') : suffix.toUpperCase();
}

export function inferGradeLevelFromClassName(className?: string | null): StudentGrade | null {
  const match = className?.trim().match(/(?:^|\D)(10|11|12)(?=\D|$)/);
  if (!match) return null;
  return Number(match[1]) as StudentGrade;
}

export function formatStudentAccountId(rawCode: string, gradeLevel: number): string {
  if (![10, 11, 12].includes(gradeLevel)) {
    throw new Error('Student class grade must be 10, 11, or 12');
  }

  const prefix = `C${gradeLevel}`;
  const trimmed = rawCode.trim().toUpperCase();
  const suffix = trimmed.match(/^C(?:10|11|12)(.+)$/)?.[1] ?? rawCode;
  return `${prefix}${normalizeSuffix(suffix)}`;
}

export function formatTeacherAccountId(rawCode: string): string {
  const prefix = 'TEA';
  const trimmed = rawCode.trim().toUpperCase();
  const suffix = trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : rawCode;
  return `${prefix}${normalizeSuffix(suffix)}`;
}

/**
 * Normalize a (Vietnamese) phone number into a stable comparison key.
 * Strips spaces/dashes/dots, converts a +84 / 84 country code into a leading 0,
 * and prefixes a bare 9-digit mobile with 0. Returns null when the value cannot
 * be a phone number, so callers can treat it as "no phone provided".
 */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  // +84 / 84 country code → national 0 prefix (e.g. 84901234567 → 0901234567)
  if (digits.startsWith('84') && digits.length >= 10 && digits.length <= 12) {
    digits = `0${digits.slice(2)}`;
  } else if (!digits.startsWith('0') && digits.length === 9) {
    // bare mobile without the leading 0 (e.g. 901234567 → 0901234567)
    digits = `0${digits}`;
  }

  if (digits.length < 9 || digits.length > 11) return null;
  return digits;
}

/**
 * Resolve the stable parent identity for a student row. An explicit parentCode
 * wins over the phone number, matching the import spec. Returns the parent code
 * used as the ParentProfile primary key plus a login username, or null when the
 * row carries no parent information.
 *
 *   parentCode "P0001"     → { parentCode: "P0001",          username: "PH.P0001" }
 *   parentPhone 0901234567 → { parentCode: "P0901234567",    username: "PH0901234567" }
 */
export function resolveParentIdentity(input: {
  parentCode?: string | null;
  parentPhone?: string | null;
}): { parentCode: string; username: string; normalizedPhone: string | null } | null {
  const rawCode = input.parentCode?.trim();
  const normalizedPhone = normalizePhone(input.parentPhone);

  if (rawCode) {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code) {
      return { parentCode: code, username: `PH.${code}`, normalizedPhone };
    }
  }

  if (normalizedPhone) {
    return { parentCode: `P${normalizedPhone}`, username: `PH${normalizedPhone}`, normalizedPhone };
  }

  return null;
}

export function formatParentAccountId(rawStudentCode: string): {
  parentCode: string;
  studentCode: string;
} {
  const code = rawStudentCode.trim().toUpperCase();
  if (!code) {
    throw new Error('Student ID is required for PARENT IDs');
  }

  if (!/^[A-Z0-9]+$/.test(code)) {
    throw new Error('Student ID can only contain letters and numbers');
  }

  const studentCode = code.endsWith('P') ? code.slice(0, -1) : code;
  if (!/^C(?:10|11|12)[A-Z0-9]+$/.test(studentCode)) {
    throw new Error('PARENT ID must be based on a STUDENT ID such as C10001');
  }

  return {
    studentCode,
    parentCode: `${studentCode}P`,
  };
}
