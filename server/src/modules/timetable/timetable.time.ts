// Time helpers for the weekly timetable. Exam schedules are stored as absolute
// instants (Timestamptz, UTC), while timetable slots are recurring weekly cells
// expressed as a day-of-week + minute-of-day. To compare them we project the
// instant onto Vietnam local wall-clock (Asia/Ho_Chi_Minh, fixed UTC+7 — Vietnam
// has no DST) so the result is deterministic regardless of the server timezone.

/** Vietnam offset from UTC, in minutes. */
const VN_OFFSET_MINUTES = 7 * 60;

/** School morning window used for soft "outside school hours" warnings: 07:00–11:15. */
export const SCHOOL_DAY = { startMinute: 7 * 60, endMinute: 11 * 60 + 15 } as const;

export interface VnClock {
  /** 1 = Monday … 6 = Saturday, 7 = Sunday. */
  dayOfWeek: number;
  /** Minutes since midnight in Vietnam local time (0–1439). */
  minuteOfDay: number;
}

/** Project a UTC instant onto Vietnam wall-clock day-of-week + minute-of-day. */
export function toVnClock(date: Date): VnClock {
  const shifted = new Date(date.getTime() + VN_OFFSET_MINUTES * 60_000);
  const jsDay = shifted.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;
  const minuteOfDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return { dayOfWeek, minuteOfDay };
}

/** Standard half-open overlap test: [aStart, aEnd) intersects [bStart, bEnd). */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** "630" → "10:30". */
export function formatMinute(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** "630, 675" → "10:30-11:15". */
export function formatMinuteRange(startMinute: number, endMinute: number): string {
  return `${formatMinute(startMinute)}-${formatMinute(endMinute)}`;
}
