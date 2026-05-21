import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface SubmitDialogProps {
  isOpen: boolean;
  unansweredCount: number;
  totalQuestions: number;
  flaggedCount: number;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SubmitDialog({
  isOpen,
  unansweredCount,
  totalQuestions,
  flaggedCount,
  isSubmitting,
  onClose,
  onConfirm,
}: SubmitDialogProps) {
  const answered = totalQuestions - unansweredCount;
  const allAnswered = unansweredCount === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Exam"
      description="Review your work before finalizing."
      size="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[var(--color-success-soft)] p-3 text-center">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Answered</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--color-success)]">
              {answered}
            </p>
          </div>
          <div className={`rounded-xl p-3 text-center ${unansweredCount > 0 ? 'bg-[var(--color-warning-soft)]' : 'bg-[var(--color-bg-subtle)]'}`}>
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Empty</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${unansweredCount > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]'}`}>
              {unansweredCount}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--color-bg-subtle)] p-3 text-center">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Flagged</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--color-secondary)]">
              {flaggedCount}
            </p>
          </div>
        </div>

        {!allAnswered ? (
          <div className="rounded-xl bg-[var(--color-warning-soft)] p-4 ring-1 ring-inset ring-[var(--color-warning)]/30">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 shrink-0 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="text-sm">
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}
                </p>
                <p className="mt-1 text-[var(--color-text-secondary)]">
                  Once submitted, you cannot change your answers.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-[var(--color-success-soft)] p-4 ring-1 ring-inset ring-[var(--color-success)]/25">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 shrink-0 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="font-semibold text-[var(--color-text-primary)]">
                  All {totalQuestions} questions answered
                </p>
                <p className="mt-1 text-[var(--color-text-secondary)]">
                  Submit to finalize your work and get results.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Go Back
          </Button>
          <Button variant={allAnswered ? 'primary' : 'danger'} onClick={onConfirm} isLoading={isSubmitting}>
            Confirm Submit
          </Button>
        </div>
      </div>
    </Modal>
  );
}
