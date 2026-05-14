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
