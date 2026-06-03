import { pearson, median, facility } from '../../../modules/exam/examStats';

describe('pearson', () => {
  it('returns null for fewer than 2 points', () => {
    expect(pearson([1], [1])).toBeNull();
    expect(pearson([], [])).toBeNull();
  });

  it('returns null when a series has no spread', () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it('is +1 for perfectly correlated series', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBe(1);
  });

  it('is -1 for perfectly anti-correlated series', () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBe(-1);
  });
});

describe('median', () => {
  it('returns null for empty', () => {
    expect(median([])).toBeNull();
  });
  it('handles odd length', () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it('averages the two middle values for even length', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('facility', () => {
  it('returns null when no scores or zero max', () => {
    expect(facility([], 1)).toBeNull();
    expect(facility([1, 2], 0)).toBeNull();
  });
  it('computes the mean fraction of points earned', () => {
    // everyone full marks → 1.0
    expect(facility([2, 2, 2], 2)).toBe(1);
    // half marks on average → 0.5
    expect(facility([0, 2], 2)).toBe(0.5);
  });
});
