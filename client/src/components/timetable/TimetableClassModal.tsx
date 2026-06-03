import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { CreateTimetableClassPayload } from '@/types/timetable';

interface TimetableClassModalProps {
  isOpen: boolean;
  saving: boolean;
  form: CreateTimetableClassPayload;
  onChange: (next: CreateTimetableClassPayload) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const selectBase =
  'h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3.5 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[var(--ring-brand)]';

/**
 * Lightweight class creation for the timetable — only a name and a grade.
 * Subject and academic year are NOT collected here (the server inherits them
 * from an existing class). For the full create flow, see the Classes page.
 */
export function TimetableClassModal({
  isOpen,
  saving,
  form,
  onChange,
  onClose,
  onSubmit,
}: TimetableClassModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Class"
      description="Add a class to the timetable. Only a name and grade are needed."
      size="sm"
    >
      <div className="space-y-4">
        <Input
          label="Class Name"
          placeholder="e.g. 10A3"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
            Grade
          </label>
          <select
            className={selectBase}
            value={form.gradeLevel}
            onChange={(e) => onChange({ ...form, gradeLevel: Number(e.target.value) })}
          >
            {[10, 11, 12].map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={saving} onClick={onSubmit}>
            Create Class
          </Button>
        </div>
      </div>
    </Modal>
  );
}
