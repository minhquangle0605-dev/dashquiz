import { ExamStatus } from '@prisma/client';

// What a student may see when reviewing a submitted attempt (§8).
export interface ReviewWindow {
  responses: boolean; // their own submitted answers
  marks: boolean; // total score / grade
  correctness: boolean; // which questions were right/wrong
  correctAnswer: boolean; // the correct option(s)
  generalFeedback: boolean; // the question explanation
}

// Review visibility differs by how long ago the attempt was submitted and
// whether the exam has closed (the four Moodle review timing windows).
export type ReviewWindowName = 'duringAttempt' | 'afterSubmit' | 'laterOpen' | 'afterClosed';

export type ReviewOptions = Record<ReviewWindowName, ReviewWindow>;

export const REVIEW_KEYS: (keyof ReviewWindow)[] = [
  'responses',
  'marks',
  'correctness',
  'correctAnswer',
  'generalFeedback',
];

// "Immediately after" lasts ~2 minutes, matching the plan's description.
const AFTER_SUBMIT_GRACE_MS = 120_000;

const ALL_ON: ReviewWindow = {
  responses: true,
  marks: true,
  correctness: true,
  correctAnswer: true,
  generalFeedback: true,
};

const ALL_OFF: ReviewWindow = {
  responses: false,
  marks: false,
  correctness: false,
  correctAnswer: false,
  generalFeedback: false,
};

// Legacy fallback: derive a full ReviewOptions from the old boolean show_result.
//   true  → everything visible once submitted (current default behaviour)
//   false → nothing until the exam closes, then everything
export function defaultReviewOptionsFromShowResult(showResult: boolean): ReviewOptions {
  if (showResult) {
    return {
      duringAttempt: { ...ALL_OFF },
      afterSubmit: { ...ALL_ON },
      laterOpen: { ...ALL_ON },
      afterClosed: { ...ALL_ON },
    };
  }
  return {
    duringAttempt: { ...ALL_OFF },
    afterSubmit: { ...ALL_OFF },
    laterOpen: { ...ALL_OFF },
    afterClosed: { ...ALL_ON },
  };
}

function coerceWindow(value: unknown): ReviewWindow {
  const out: ReviewWindow = { ...ALL_OFF };
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of REVIEW_KEYS) {
      if (record[key] === true) out[key] = true;
    }
  }
  return out;
}

// Safely coerce an arbitrary JSON value into a full ReviewOptions, or null when
// it is not an object (so callers fall back to show_result).
export function parseReviewOptions(json: unknown): ReviewOptions | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  return {
    duringAttempt: coerceWindow(o.duringAttempt),
    afterSubmit: coerceWindow(o.afterSubmit),
    laterOpen: coerceWindow(o.laterOpen),
    afterClosed: coerceWindow(o.afterClosed),
  };
}

export function resolveReviewWindow(params: {
  examStatus: ExamStatus;
  scheduleEndsAt: Date | null;
  submittedAt: Date | null;
  now: Date;
}): ReviewWindowName {
  const { examStatus, scheduleEndsAt, submittedAt, now } = params;
  const closed =
    examStatus === ExamStatus.CLOSED ||
    (scheduleEndsAt !== null && scheduleEndsAt.getTime() <= now.getTime());
  if (closed) return 'afterClosed';
  if (submittedAt && now.getTime() - new Date(submittedAt).getTime() <= AFTER_SUBMIT_GRACE_MS) {
    return 'afterSubmit';
  }
  return 'laterOpen';
}

// Resolve the active window and the flags that apply, honouring an explicit
// review_options config when present and falling back to show_result otherwise.
export function getReviewWindowFlags(params: {
  reviewOptions: unknown;
  showResult: boolean;
  examStatus: ExamStatus;
  scheduleEndsAt: Date | null;
  submittedAt: Date | null;
  now: Date;
}): { window: ReviewWindowName; flags: ReviewWindow } {
  const options =
    parseReviewOptions(params.reviewOptions) ??
    defaultReviewOptionsFromShowResult(params.showResult);
  const window = resolveReviewWindow(params);
  return { window, flags: options[window] };
}

export function hasAnyReview(flags: ReviewWindow): boolean {
  return REVIEW_KEYS.some((key) => flags[key]);
}
