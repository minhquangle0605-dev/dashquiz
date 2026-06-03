import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { ClassCourseOverview, ClassResource } from '@/types/exam';

export interface ResourceFormValues {
  title: string;
  description: string;
  type: ClassResource['type'];
  sectionId: number | '';
  url: string;
  content: string;
  file: File | null;
  isPublished: boolean;
}

interface ResourceModalProps {
  isOpen: boolean;
  saving: boolean;
  form: ResourceFormValues;
  course: ClassCourseOverview | null;
  onChange: (next: ResourceFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const selectBase =
  'h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3.5 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[var(--ring-brand)]';

const textareaBase =
  'min-h-32 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[var(--ring-brand)]';

export function ResourceModal({
  isOpen,
  saving,
  form,
  course,
  onChange,
  onClose,
  onSubmit,
}: ResourceModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Resource" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
              Type
            </label>
            <select
              className={selectBase}
              value={form.type}
              onChange={(e) =>
                onChange({ ...form, type: e.target.value as ClassResource['type'] })
              }
            >
              <option value="LESSON">Lesson</option>
              <option value="LINK">Link</option>
              <option value="VIDEO">Video</option>
              <option value="IMAGE">Image</option>
              <option value="FILE">File</option>
            </select>
          </div>
        </div>
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
          label="Description"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
        {form.type === 'FILE' || form.type === 'IMAGE' ? (
          <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-6 text-center transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/50">
            <svg className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
              {form.file
                ? form.file.name
                : form.type === 'IMAGE'
                  ? 'Click to select an image'
                  : 'Click to select a file'}
            </p>
            {form.type === 'IMAGE' && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                JPG, PNG, WebP, or GIF. Max 10MB.
              </p>
            )}
            <input
              type="file"
              accept={form.type === 'IMAGE' ? 'image/jpeg,image/png,image/webp,image/gif' : undefined}
              className="hidden"
              onChange={(e) =>
                onChange({ ...form, file: e.target.files?.[0] ?? null })
              }
            />
          </label>
        ) : form.type === 'LESSON' ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
              Lesson content
            </label>
            <textarea
              className={textareaBase}
              placeholder="Lesson content…"
              value={form.content}
              onChange={(e) => onChange({ ...form, content: e.target.value })}
            />
          </div>
        ) : (
          <Input
            label={form.type === 'VIDEO' ? 'Video URL' : 'URL'}
            placeholder="https://…"
            value={form.url}
            onChange={(e) => onChange({ ...form, url: e.target.value })}
          />
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/40"
            checked={form.isPublished}
            onChange={(e) => onChange({ ...form, isPublished: e.target.checked })}
          />
          Publish to students
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={saving} onClick={onSubmit}>
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}
