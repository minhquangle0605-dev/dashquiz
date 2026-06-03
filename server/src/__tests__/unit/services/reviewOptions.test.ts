import {
  defaultReviewOptionsFromShowResult,
  parseReviewOptions,
  resolveReviewWindow,
  getReviewWindowFlags,
  hasAnyReview,
} from '../../../modules/exam/reviewOptions';

describe('defaultReviewOptionsFromShowResult', () => {
  it('showResult=true reveals everything once submitted', () => {
    const o = defaultReviewOptionsFromShowResult(true);
    expect(o.afterSubmit.marks).toBe(true);
    expect(o.afterSubmit.correctAnswer).toBe(true);
    expect(o.afterClosed.correctAnswer).toBe(true);
    expect(o.duringAttempt.marks).toBe(false);
  });

  it('showResult=false hides everything until the exam closes', () => {
    const o = defaultReviewOptionsFromShowResult(false);
    expect(hasAnyReview(o.afterSubmit)).toBe(false);
    expect(hasAnyReview(o.laterOpen)).toBe(false);
    expect(o.afterClosed.marks).toBe(true);
    expect(o.afterClosed.correctAnswer).toBe(true);
  });
});

describe('parseReviewOptions', () => {
  it('returns null for non-objects', () => {
    expect(parseReviewOptions(null)).toBeNull();
    expect(parseReviewOptions(undefined)).toBeNull();
    expect(parseReviewOptions('x')).toBeNull();
  });

  it('coerces partial windows, defaulting missing keys to false', () => {
    const parsed = parseReviewOptions({ afterSubmit: { marks: true } });
    expect(parsed?.afterSubmit.marks).toBe(true);
    expect(parsed?.afterSubmit.correctAnswer).toBe(false);
    expect(parsed?.laterOpen.marks).toBe(false);
  });

  it('ignores non-boolean / unknown keys', () => {
    const parsed = parseReviewOptions({ afterSubmit: { marks: 'yes', bogus: true } });
    expect(parsed?.afterSubmit.marks).toBe(false);
  });
});

describe('resolveReviewWindow', () => {
  const now = new Date('2026-05-31T10:00:00Z');

  it('afterClosed when exam status is CLOSED', () => {
    expect(
      resolveReviewWindow({ examStatus: 'CLOSED', scheduleEndsAt: null, submittedAt: now, now }),
    ).toBe('afterClosed');
  });

  it('afterClosed when the schedule end has passed', () => {
    expect(
      resolveReviewWindow({
        examStatus: 'PUBLISHED',
        scheduleEndsAt: new Date('2026-05-31T09:00:00Z'),
        submittedAt: new Date('2026-05-31T09:59:50Z'),
        now,
      }),
    ).toBe('afterClosed');
  });

  it('afterSubmit within the 2-minute grace', () => {
    expect(
      resolveReviewWindow({
        examStatus: 'PUBLISHED',
        scheduleEndsAt: new Date('2026-05-31T12:00:00Z'),
        submittedAt: new Date('2026-05-31T09:59:00Z'),
        now,
      }),
    ).toBe('afterSubmit');
  });

  it('laterOpen after the grace while still open', () => {
    expect(
      resolveReviewWindow({
        examStatus: 'PUBLISHED',
        scheduleEndsAt: new Date('2026-05-31T12:00:00Z'),
        submittedAt: new Date('2026-05-31T09:50:00Z'),
        now,
      }),
    ).toBe('laterOpen');
  });
});

describe('getReviewWindowFlags', () => {
  const now = new Date('2026-05-31T10:00:00Z');

  it('falls back to show_result when reviewOptions is null', () => {
    const { window, flags } = getReviewWindowFlags({
      reviewOptions: null,
      showResult: true,
      examStatus: 'PUBLISHED',
      scheduleEndsAt: new Date('2026-05-31T12:00:00Z'),
      submittedAt: new Date('2026-05-31T09:59:30Z'),
      now,
    });
    expect(window).toBe('afterSubmit');
    expect(flags.marks).toBe(true);
  });

  it('honours an explicit review_options config (strict: marks only after submit)', () => {
    const { flags } = getReviewWindowFlags({
      reviewOptions: { afterSubmit: { marks: true } },
      showResult: true,
      examStatus: 'PUBLISHED',
      scheduleEndsAt: new Date('2026-05-31T12:00:00Z'),
      submittedAt: new Date('2026-05-31T09:59:30Z'),
      now,
    });
    expect(flags.marks).toBe(true);
    expect(flags.correctAnswer).toBe(false);
    expect(flags.responses).toBe(false);
  });
});
