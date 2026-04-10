/** Ba môn cố định của dự án (Toán, Lý, Hóa). */
export const CORE_SUBJECT_CODES = ['MATH', 'PHY', 'CHEM'] as const;

export function isCoreSubjectCode(code: string): boolean {
  return (CORE_SUBJECT_CODES as readonly string[]).includes(code);
}
