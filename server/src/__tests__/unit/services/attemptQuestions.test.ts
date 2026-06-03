import { Prisma } from '@prisma/client';
import {
  shuffleDeterministic,
  buildAttemptQuestions,
  type AttemptQuestionSource,
} from '../../../modules/student-exam/attemptQuestions';

describe('shuffleDeterministic', () => {
  it('is stable for the same seed', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(shuffleDeterministic(arr, 42)).toEqual(shuffleDeterministic(arr, 42));
  });

  it('produces a permutation (no loss/duplication)', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffleDeterministic(arr, 99);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(arr);
  });

  it('does not mutate the input array', () => {
    const arr = [1, 2, 3];
    shuffleDeterministic(arr, 7);
    expect(arr).toEqual([1, 2, 3]);
  });
});

function makeExam(shuffle: boolean, shuffleAnswers: boolean): AttemptQuestionSource {
  return {
    shuffle,
    shuffleAnswers,
    examQuestions: [1, 2, 3].map((qid) => ({
      questionId: qid,
      orderIndex: qid,
      points: new Prisma.Decimal(1),
      question: {
        content: `Q${qid}`,
        questionType: 'SINGLE_CHOICE',
        options: [10, 20, 30, 40].map((oid) => ({
          id: oid * qid,
          label: String(oid),
          content: `opt-${oid}`,
        })),
      },
    })),
  };
}

describe('buildAttemptQuestions', () => {
  it('keeps original order when no shuffle flags', () => {
    const exam = makeExam(false, false);
    const result = buildAttemptQuestions(exam, 5);
    expect(result.map((q) => q.questionId)).toEqual([1, 2, 3]);
    expect(result[0].options.map((o) => o.id)).toEqual([10, 20, 30, 40]);
  });

  it('shuffles answer options but preserves the option set per question', () => {
    const exam = makeExam(false, true);
    const result = buildAttemptQuestions(exam, 5);
    const firstIds = result[0].options.map((o) => o.id).sort((a, b) => a - b);
    expect(firstIds).toEqual([10, 20, 30, 40]);
  });

  it('is stable across resume (same attemptId yields same ordering)', () => {
    const exam = makeExam(true, true);
    const a = buildAttemptQuestions(exam, 777);
    const b = buildAttemptQuestions(exam, 777);
    expect(a.map((q) => q.questionId)).toEqual(b.map((q) => q.questionId));
    expect(a[0].options.map((o) => o.id)).toEqual(b[0].options.map((o) => o.id));
  });

  it('different attempts can yield different question order', () => {
    const exam = makeExam(true, false);
    const orders = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((id) =>
        buildAttemptQuestions(exam, id).map((q) => q.questionId).join(','),
      ),
    );
    // With 3 questions there are 6 permutations; across 8 seeds we expect >1.
    expect(orders.size).toBeGreaterThan(1);
  });
});
