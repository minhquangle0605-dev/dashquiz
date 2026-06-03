import type { TimetableSlot } from '@/types/timetable';

export const DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export const DAY_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

/** Default period start/end (minute-of-day) used to prefill the slot form. */
export const PERIOD_TIMES: Record<number, { start: number; end: number }> = {
  1: { start: 420, end: 465 },
  2: { start: 470, end: 515 },
  3: { start: 520, end: 565 },
  4: { start: 585, end: 630 },
  5: { start: 630, end: 675 },
};

export function formatMinute(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatMinuteRange(start: number, end: number): string {
  return `${formatMinute(start)}-${formatMinute(end)}`;
}

export function slotKey(dayOfWeek: number, periodIndex: number): string {
  return `${dayOfWeek}-${periodIndex}`;
}

/** Group active slots by `${day}-${period}`. */
export function groupSlots(slots: TimetableSlot[]): Map<string, TimetableSlot[]> {
  const map = new Map<string, TimetableSlot[]>();
  for (const slot of slots) {
    const key = slotKey(slot.dayOfWeek, slot.periodIndex);
    const existing = map.get(key);
    if (existing) existing.push(slot);
    else map.set(key, [slot]);
  }
  return map;
}
