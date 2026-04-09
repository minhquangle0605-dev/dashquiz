/**
 * Planned Zod schemas (question module):
 * - createQuestionBodySchema — type, stem, options[], correct, explanation, difficulty, subjectId
 * - updateQuestionBodySchema — partial fields
 * - questionIdParamSchema
 * - listQuestionsQuerySchema — subjectId, tag, difficulty, page, limit, search
 * - importQuestionsFileSchema — multipart metadata
 * - setTagsBodySchema — tags: string[]
 */

export const questionSchemas = {} as const;
