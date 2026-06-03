import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getImportTemplateUrl } from '@/services/class.api';

interface ImportStudentsModalProps {
  isOpen: boolean;
  importing: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function ImportStudentsModal({
  isOpen,
  importing,
  file,
  onFileChange,
  onClose,
  onSubmit,
}: ImportStudentsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Students from Excel"
      description="Upload an Excel file containing student information."
      size="md"
    >
      <div className="space-y-4">
        <a
          href={getImportTemplateUrl()}
          download
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft-strong)]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Template
        </a>

        <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-8 text-center transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/50">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5l3-3m0 0l3 3m-3-3v9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {file ? file.name : 'Click to select an Excel file'}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Supports .xlsx, .xls, .csv
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isLoading={importing}
            disabled={!file}
            onClick={onSubmit}
          >
            Import
          </Button>
        </div>
      </div>
    </Modal>
  );
}
