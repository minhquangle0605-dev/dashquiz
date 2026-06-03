import { useMemo } from 'react';
import type { TimetableSlot } from '@/types/timetable';
import {
  DAY_SHORT,
  PERIOD_TIMES,
  formatMinuteRange,
  groupSlots,
  slotKey,
} from './timetableUtils';

interface ClassTimetableGridProps {
  slots: TimetableSlot[];
  /** When true, render add/edit/cancel affordances. */
  canManage?: boolean;
  onAddSlot?: (dayOfWeek: number, periodIndex: number) => void;
  onEditSlot?: (slot: TimetableSlot) => void;
  onCancelSlot?: (slot: TimetableSlot) => void;
}

export function ClassTimetableGrid({
  slots,
  canManage = false,
  onAddSlot,
  onEditSlot,
  onCancelSlot,
}: ClassTimetableGridProps) {
  const grouped = useMemo(() => groupSlots(slots), [slots]);

  // Saturday is a school day in VN; show Sunday only when slots exist there.
  const days = useMemo(() => {
    const base = [1, 2, 3, 4, 5, 6];
    if (slots.some((s) => s.dayOfWeek === 7)) base.push(7);
    return base;
  }, [slots]);

  const periods = useMemo(() => {
    const maxPeriod = slots.reduce((max, s) => Math.max(max, s.periodIndex), 5);
    return Array.from({ length: maxPeriod }, (_, i) => i + 1);
  }, [slots]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)]">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--color-bg-subtle)]">
            <th className="w-20 border-b border-[var(--color-border)] px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Period
            </th>
            {days.map((day) => (
              <th
                key={day}
                className="border-b border-l border-[var(--color-border)] px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]"
              >
                {DAY_SHORT[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => {
            const defaults = PERIOD_TIMES[period];
            return (
              <tr key={period} className="align-top">
                <th className="border-b border-[var(--color-border-subtle)] px-3 py-2 text-left">
                  <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                    P{period}
                  </span>
                  {defaults && (
                    <span className="block text-[10px] text-[var(--color-text-muted)]">
                      {formatMinuteRange(defaults.start, defaults.end)}
                    </span>
                  )}
                </th>
                {days.map((day) => {
                  const cellSlots = grouped.get(slotKey(day, period)) ?? [];
                  return (
                    <td
                      key={day}
                      className="border-b border-l border-[var(--color-border-subtle)] p-1.5"
                    >
                      <div className="flex min-h-[52px] flex-col gap-1.5">
                        {cellSlots.map((slot) => (
                          <SlotCard
                            key={slot.id}
                            slot={slot}
                            canManage={canManage}
                            onEdit={onEditSlot}
                            onCancel={onCancelSlot}
                          />
                        ))}
                        {canManage && cellSlots.length === 0 && (
                          <button
                            type="button"
                            onClick={() => onAddSlot?.(day, period)}
                            className="flex h-full min-h-[52px] w-full items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                            aria-label={`Add slot ${DAY_SHORT[day]} P${period}`}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SlotCard({
  slot,
  canManage,
  onEdit,
  onCancel,
}: {
  slot: TimetableSlot;
  canManage: boolean;
  onEdit?: (slot: TimetableSlot) => void;
  onCancel?: (slot: TimetableSlot) => void;
}) {
  const isManaged = slot.kind === 'MANAGED_SUBJECT';
  return (
    <div
      className={`group rounded-lg border px-2 py-1.5 text-left ${
        isManaged
          ? 'border-[var(--color-primary-soft-strong)] bg-[var(--color-primary-soft)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg-subtle)]'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`text-xs font-bold ${
            isManaged ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
          }`}
        >
          {slot.subject?.name ?? slot.displayName}
        </span>
        {canManage && (
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onEdit?.(slot)}
              className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              aria-label="Edit slot"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onCancel?.(slot)}
              className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
              aria-label="Cancel slot"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
        {formatMinuteRange(slot.startMinute, slot.endMinute)}
        {slot.room ? ` · ${slot.room}` : ''}
      </div>
    </div>
  );
}
