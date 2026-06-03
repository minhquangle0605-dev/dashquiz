import { computeFinalScore } from '../../../modules/exam/grading';

const t = (score: number | null, daysAgo: number) => ({
  totalScore: score,
  startedAt: new Date(2026, 0, 10 - daysAgo),
});

describe('computeFinalScore', () => {
  it('returns null when there are no scorable attempts', () => {
    expect(computeFinalScore([], 'HIGHEST')).toBeNull();
    expect(computeFinalScore([t(null, 0)], 'AVERAGE')).toBeNull();
  });

  it('HIGHEST takes the maximum score', () => {
    expect(computeFinalScore([t(6, 2), t(9, 1), t(4, 0)], 'HIGHEST')).toBe(9);
  });

  it('AVERAGE takes the mean of all scores', () => {
    expect(computeFinalScore([t(6, 2), t(9, 1), t(3, 0)], 'AVERAGE')).toBe(6);
  });

  it('FIRST takes the earliest attempt by startedAt', () => {
    // daysAgo larger = earlier date
    expect(computeFinalScore([t(4, 0), t(7, 3), t(9, 1)], 'FIRST')).toBe(7);
  });

  it('LAST takes the most recent attempt by startedAt', () => {
    expect(computeFinalScore([t(4, 0), t(7, 3), t(9, 1)], 'LAST')).toBe(4);
  });

  it('defaults to HIGHEST', () => {
    expect(computeFinalScore([t(2, 1), t(8, 0)])).toBe(8);
  });

  it('ignores null-score attempts but keeps valid ones', () => {
    expect(computeFinalScore([t(null, 2), t(5, 1), t(null, 0)], 'AVERAGE')).toBe(5);
  });

  it('rounds to 2 decimals', () => {
    expect(computeFinalScore([t(1, 2), t(2, 1), t(2, 0)], 'AVERAGE')).toBe(1.67);
  });
});
