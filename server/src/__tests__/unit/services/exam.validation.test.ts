import {
  createExamSchema,
  updateExamSchema,
} from '../../../modules/exam/exam.validation';

describe('exam validation schemas', () => {
  it('allows maxAttempts up to the UI custom limit', () => {
    const basePayload = {
      title: 'Chem1',
      subjectId: 1,
      durationMin: 45,
      totalQuestions: 24,
      maxAttempts: 99,
    };

    expect(createExamSchema.safeParse(basePayload).success).toBe(true);
    expect(updateExamSchema.safeParse({ maxAttempts: 99 }).success).toBe(true);
  });
});
