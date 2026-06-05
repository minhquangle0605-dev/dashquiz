import { pearson, median, facility, stdev, discrimination27 } from '../../../modules/exam/examStats';

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

describe('stdev', () => {
  it('returns null for fewer than 2 values', () => {
    expect(stdev([])).toBeNull();
    expect(stdev([5])).toBeNull();
  });
  it('is 0 when all values are equal', () => {
    expect(stdev([4, 4, 4, 4])).toBe(0);
  });
  it('computes the population standard deviation', () => {
    // values 2,4,4,4,5,5,7,9 → mean 5, population sd = 2
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
});

describe('discrimination27', () => {
  it('returns null for fewer than 4 attempts', () => {
    expect(discrimination27([1, 0, 1], [3, 2, 1])).toBeNull();
  });
  it('returns null when lengths differ', () => {
    expect(discrimination27([1, 0, 1, 0], [3, 2, 1])).toBeNull();
  });
  it('is +1 when only the strongest test-takers answer correctly', () => {
    // top group all correct (1), bottom group all wrong (0)
    const values = [1, 1, 0, 0, 0, 0, 1, 1];
    const ranks = [10, 9, 1, 2, 3, 4, 8, 7];
    expect(discrimination27(values, ranks)).toBe(1);
  });
  it('is negative when weak students outperform strong ones on the item', () => {
    const values = [0, 0, 1, 1];
    const ranks = [10, 9, 2, 1];
    expect(discrimination27(values, ranks)!).toBeLessThan(0);
  });
});
