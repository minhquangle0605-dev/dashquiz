import {
  SCHOOL_DAY,
  formatMinute,
  formatMinuteRange,
  rangesOverlap,
  toVnClock,
} from '../../modules/timetable/timetable.time';

describe('timetable.time helpers', () => {
  describe('toVnClock', () => {
    it('maps a UTC instant to Vietnam wall-clock day-of-week and minute-of-day', () => {
      // 2024-01-01 was a Monday. 03:45Z + 7h = 10:45 VN.
      const clock = toVnClock(new Date('2024-01-01T03:45:00Z'));
      expect(clock.dayOfWeek).toBe(1); // Monday
      expect(clock.minuteOfDay).toBe(10 * 60 + 45);
    });

    it('returns 7 for Sunday', () => {
      // 2024-01-07 was a Sunday.
      const clock = toVnClock(new Date('2024-01-07T03:00:00Z'));
      expect(clock.dayOfWeek).toBe(7);
      expect(clock.minuteOfDay).toBe(10 * 60);
    });

    it('rolls into the next VN day when the +7h shift crosses midnight', () => {
      // 2024-01-01 18:30Z + 7h = 2024-01-02 01:30 VN (Tuesday).
      const clock = toVnClock(new Date('2024-01-01T18:30:00Z'));
      expect(clock.dayOfWeek).toBe(2); // Tuesday
      expect(clock.minuteOfDay).toBe(90);
    });
  });

  describe('rangesOverlap', () => {
    it('detects overlap with the half-open rule', () => {
      expect(rangesOverlap(600, 700, 650, 720)).toBe(true);
      expect(rangesOverlap(600, 650, 650, 700)).toBe(false); // touching edges do not overlap
      expect(rangesOverlap(600, 700, 700, 800)).toBe(false);
      expect(rangesOverlap(630, 675, 645, 670)).toBe(true); // 10:45–11:10 inside 10:30–11:15
    });
  });

  describe('formatting', () => {
    it('formats minute-of-day as HH:MM', () => {
      expect(formatMinute(630)).toBe('10:30');
      expect(formatMinute(7)).toBe('00:07');
      expect(formatMinuteRange(630, 675)).toBe('10:30-11:15');
    });
  });

  it('defines the morning school window as 07:00–11:15', () => {
    expect(SCHOOL_DAY.startMinute).toBe(420);
    expect(SCHOOL_DAY.endMinute).toBe(675);
  });
});
