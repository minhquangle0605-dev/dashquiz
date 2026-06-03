import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { CreateClassPayload } from '@/types/exam';
import type { CurriculumSubject } from '@/types/question';

export type ClassFormValues = CreateClassPayload & { academicYearString?: string };

interface ClassFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  saving: boolean;
  form: ClassFormValues;
  subjects: CurriculumSubject[];
  onChange: (next: ClassFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const selectBase =
  'h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3.5 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[var(--ring-brand)]';

export function ClassFormModal({
  isOpen,
  isEditing,
  saving,
  form,
  subjects,
  onChange,
  onClose,
  onSubmit,
}: ClassFormModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Class' : 'Create New Class'}
      description={isEditing ? 'Update class information.' : 'Fill in the details to create a class.'}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label="Class Name"
          placeholder="e.g. 10A1"
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
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
            Subject
          </label>
          <select
            className={selectBase}
            value={form.subjectId || ''}
            onChange={(e) => onChange({ ...form, subjectId: Number(e.target.value) })}
          >
            <option value="">Select a subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Academic Year"
          placeholder="e.g. 2024 - 2025"
          hint="Type 4 digits to auto-format"
          value={form.academicYearString || ''}
          onChange={(e) => {
            let val = e.target.value;
            if (/^\d{4}$/.test(val)) {
              const startYear = parseInt(val, 10);
              val = `${startYear} - ${startYear + 1}`;
            }
            onChange({ ...form, academicYearString: val });
          }}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={saving} onClick={onSubmit}>
            {isEditing ? 'Save Changes' : 'Create Class'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
