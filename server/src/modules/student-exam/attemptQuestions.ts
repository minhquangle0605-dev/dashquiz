import type { Prisma } from '@prisma/client';

// Deterministic Fisher–Yates so that shuffled question/answer order stays
// stable across resume (same attemptId + question = same order). Grading is by
// option id, so reordering never affects correctness.
export function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface AttemptQuestionSource {
  shuffle: boolean;
  shuffleAnswers: boolean;
  examQuestions: Array<{
    questionId: number;
    orderIndex: number;
    points: Prisma.Decimal;
    question: {
      content: string;
      questionType: string;
      options: Array<{ id: number; label: string; content: string }>;
    };
  }>;
}

// Build the per-attempt question payload, applying (optional) answer-option
// shuffle and question-order shuffle, both seeded by the attempt so a resume
// returns the exact same ordering the student saw before.
export function buildAttemptQuestions(exam: AttemptQuestionSource, attemptId: number) {
  let questions = exam.examQuestions.map((eq) => ({
    questionId: eq.questionId,
    orderIndex: eq.orderIndex,
    points: eq.points,
    content: eq.question.content,
    questionType: eq.question.questionType,
    options: exam.shuffleAnswers
      ? shuffleDeterministic(eq.question.options, attemptId * 100000 + eq.questionId)
      : eq.question.options,
  }));

  if (exam.shuffle) {
    questions = shuffleDeterministic(questions, attemptId);
  }

  return questions;
}
