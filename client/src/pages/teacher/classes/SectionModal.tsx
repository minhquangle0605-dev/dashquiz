import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

export interface SectionFormValues {
  title: string;
  description: string;
  isPublished: boolean;
}

interface SectionModalProps {
  isOpen: boolean;
  saving: boolean;
  form: SectionFormValues;
  onChange: (next: SectionFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function SectionModal({
  isOpen,
  saving,
  form,
  onChange,
  onClose,
  onSubmit,
}: SectionModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Section" size="md">
      <div className="space-y-4">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
        />
        <Input
          label="Description"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
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
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}
