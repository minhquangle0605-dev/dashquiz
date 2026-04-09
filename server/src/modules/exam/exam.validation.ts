/**
 * Planned Zod schemas (exam module):
 * - createExamBodySchema — title, description, durationMinutes, questionIds[], settings
 * - updateExamBodySchema — partial settings
 * - examIdParamSchema
 * - scheduleExamBodySchema — openAt, closeAt, timezone
 * - assignExamBodySchema — classIds[], studentIds[]
 * - listExamsQuerySchema — status, classId, academicYearId, page, limit
 */

export const examSchemas = {} as const;
