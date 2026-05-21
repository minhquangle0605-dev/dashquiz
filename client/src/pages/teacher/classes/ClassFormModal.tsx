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
      title={isEditing ? 'Chỉnh sửa lớp' : 'Tạo lớp mới'}
      description={isEditing ? 'Cập nhật thông tin lớp học.' : 'Điền thông tin để tạo lớp.'}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label="Tên lớp"
          placeholder="vd. 10A1"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
            Khối
          </label>
          <select
            className={selectBase}
            value={form.gradeLevel}
            onChange={(e) => onChange({ ...form, gradeLevel: Number(e.target.value) })}
          >
            {[10, 11, 12].map((g) => (
              <option key={g} value={g}>
                Khối {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
            Môn học
          </label>
          <select
            className={selectBase}
            value={form.subjectId || ''}
            onChange={(e) => onChange({ ...form, subjectId: Number(e.target.value) })}
          >
            <option value="">Chọn môn học</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Năm học"
          placeholder="vd. 2024 - 2025"
          hint="Gõ 4 chữ số để tự động format"
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
            Hủy
          </Button>
          <Button variant="primary" isLoading={saving} onClick={onSubmit}>
            {isEditing ? 'Lưu thay đổi' : 'Tạo lớp'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
