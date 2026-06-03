import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { CreateSlotPayload, TimetableSlot } from '@/types/timetable';
import { DAY_LABELS, PERIOD_TIMES, formatMinute } from './timetableUtils';

interface SlotFormModalProps {
  isOpen: boolean;
  saving: boolean;
  /** Existing slot when editing; null when creating. */
  slot: TimetableSlot | null;
  /** Prefill for a new slot (from clicking an empty cell). */
  prefill?: { dayOfWeek: number; periodIndex: number } | null;
  onSubmit: (payload: CreateSlotPayload) => void;
  onClose: () => void;
}

function minuteToTimeInput(minute: number): string {
  return formatMinute(minute);
}

function timeInputToMinute(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function SlotFormModal({
  isOpen,
  saving,
  slot,
  prefill,
  onSubmit,
  onClose,
}: SlotFormModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [periodIndex, setPeriodIndex] = useState(1);
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('07:45');
  const [room, setRoom] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (slot) {
      setDisplayName(slot.displayName);
      setDayOfWeek(slot.dayOfWeek);
      setPeriodIndex(slot.periodIndex);
      setStartTime(minuteToTimeInput(slot.startMinute));
      setEndTime(minuteToTimeInput(slot.endMinute));
      setRoom(slot.room ?? '');
    } else {
      const period = prefill?.periodIndex ?? 1;
      const day = prefill?.dayOfWeek ?? 1;
      const times = PERIOD_TIMES[period];
      setDisplayName('');
      setDayOfWeek(day);
      setPeriodIndex(period);
      setStartTime(minuteToTimeInput(times?.start ?? 420));
      setEndTime(minuteToTimeInput(times?.end ?? 465));
      setRoom('');
    }
  }, [isOpen, slot, prefill]);

  // When the period changes on a new slot, sync the default times.
  const handlePeriodChange = (next: number) => {
    setPeriodIndex(next);
    if (!slot) {
      const times = PERIOD_TIMES[next];
      if (times) {
        setStartTime(minuteToTimeInput(times.start));
        setEndTime(minuteToTimeInput(times.end));
      }
    }
  };

  const handleSubmit = () => {
    const startMinute = timeInputToMinute(startTime);
    const endMinute = timeInputToMinute(endTime);
    if (!displayName.trim()) {
      setError('Subject / activity name is required.');
      return;
    }
    if (startMinute === null || endMinute === null) {
      setError('Enter valid times in HH:MM format.');
      return;
    }
    if (endMinute <= startMinute) {
      setError('End time must be after start time.');
      return;
    }
    onSubmit({
      displayName: displayName.trim(),
      dayOfWeek,
      periodIndex,
      startMinute,
      endMinute,
      room: room.trim() || null,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={slot ? 'Edit timetable slot' : 'Add timetable slot'}
      description="Mathematics, Physics and Chemistry are auto-linked as managed subjects."
      size="md"
    >
      <div className="space-y-4">
        <Input
          label="Subject / activity name"
          placeholder="e.g. Mathematics, Literature, Flag Ceremony"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">Day</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {DAY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">Period</label>
            <select
              value={periodIndex}
              onChange={(e) => handlePeriodChange(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                <option key={p} value={p}>
                  Period {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="End time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <Input
          label="Room (optional)"
          placeholder="e.g. A101"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />

        {error && <p className="text-xs font-medium text-[var(--color-danger)]">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={saving} onClick={handleSubmit}>
            {slot ? 'Save changes' : 'Add slot'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
