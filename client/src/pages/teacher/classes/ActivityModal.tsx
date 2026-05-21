import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { ClassActivity, ClassCourseOverview } from '@/types/exam';

export interface ActivityFormValues {
  title: string;
  type: ClassActivity['type'];
  sectionId: number | '';
  instructions: string;
  dueAt: string;
  maxScore: string;
  status: ClassActivity['status'];
}

interface ActivityModalProps {
  isOpen: boolean;
  saving: boolean;
  form: ActivityFormValues;
  course: ClassCourseOverview | null;
  onChange: (next: ActivityFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const selectBase =
  'h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3.5 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[var(--ring-brand)]';

const textareaBase =
  'min-h-32 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[var(--ring-brand)]';

export function ActivityModal({
  isOpen,
  saving,
  form,
  course,
  onChange,
  onClose,
  onSubmit,
}: ActivityModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm Activity" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Tiêu đề"
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
              Loại
            </label>
            <select
              className={selectBase}
              value={form.type}
              onChange={(e) =>
                onChange({ ...form, type: e.target.value as ClassActivity['type'] })
              }
            >
              <option value="ASSIGNMENT">Assignment</option>
              <option value="QUIZ">Quiz</option>
              <option value="FORUM">Forum</option>
              <option value="WORKSHOP">Workshop</option>
              <option value="ATTENDANCE">Attendance</option>
              <option value="SURVEY">Survey</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
              Section
            </label>
            <select
              className={selectBase}
              value={form.sectionId}
              onChange={(e) =>
                onChange({
                  ...form,
                  sectionId: e.target.value ? Number(e.target.value) : '',
                })
              }
            >
              <option value="">General</option>
              {course?.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Hạn nộp"
            type="datetime-local"
            value={form.dueAt}
            onChange={(e) => onChange({ ...form, dueAt: e.target.value })}
          />
          <Input
            label="Max score"
            type="number"
            placeholder="vd. 10"
            value={form.maxScore}
            onChange={(e) => onChange({ ...form, maxScore: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
            Hướng dẫn
          </label>
          <textarea
            className={textareaBase}
            placeholder="Mô tả / hướng dẫn cho học sinh…"
            value={form.instructions}
            onChange={(e) => onChange({ ...form, instructions: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" isLoading={saving} onClick={onSubmit}>
            Tạo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
