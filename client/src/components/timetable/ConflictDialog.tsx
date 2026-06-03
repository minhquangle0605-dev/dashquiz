import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { ConflictItem } from '@/types/timetable';

interface ConflictDialogProps {
  isOpen: boolean;
  hardConflicts: ConflictItem[];
  softWarnings: ConflictItem[];
  /** Whether the current user may force past hard conflicts (admin only). */
  canForce: boolean;
  forcing?: boolean;
  /** Called when the user chooses to schedule anyway (force) or to proceed past soft-only warnings. */
  onConfirm: () => void;
  onClose: () => void;
}

export function ConflictDialog({
  isOpen,
  hardConflicts,
  softWarnings,
  canForce,
  forcing = false,
  onConfirm,
  onClose,
}: ConflictDialogProps) {
  const hasHard = hardConflicts.length > 0;
  // With only soft warnings the action is always allowed to proceed.
  const canProceed = !hasHard || canForce;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={hasHard ? 'Schedule conflicts detected' : 'Scheduling warnings'}
      description={
        hasHard
          ? 'This time clashes with a managed Math/Physics/Chemistry slot or another exam.'
          : 'Review the warnings below before continuing.'
      }
      size="md"
    >
      <div className="space-y-4">
        {hasHard && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[var(--color-danger)]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              Hard conflicts ({hardConflicts.length})
            </h3>
            <ul className="space-y-1.5">
              {hardConflicts.map((c, i) => (
                <ConflictRow key={`hard-${i}`} item={c} tone="danger" />
              ))}
            </ul>
          </section>
        )}

        {softWarnings.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[var(--color-warning)]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Warnings ({softWarnings.length})
            </h3>
            <ul className="space-y-1.5">
              {softWarnings.map((c, i) => (
                <ConflictRow key={`soft-${i}`} item={c} tone="warning" />
              ))}
            </ul>
          </section>
        )}

        {hasHard && !canForce && (
          <p className="rounded-lg bg-[var(--color-bg-subtle)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            Only an administrator can schedule over a hard conflict. Pick a different time, or ask an admin to override.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            {canProceed ? 'Cancel' : 'Close'}
          </Button>
          {canProceed && (
            <Button
              variant={hasHard ? 'danger' : 'primary'}
              isLoading={forcing}
              onClick={onConfirm}
            >
              {hasHard ? 'Schedule anyway' : 'Schedule'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ConflictRow({ item, tone }: { item: ConflictItem; tone: 'danger' | 'warning' }) {
  const ring =
    tone === 'danger'
      ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5'
      : 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5';
  return (
    <li className={`rounded-lg border px-3 py-2 ${ring}`}>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.message}</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
        {item.time}
        {item.className ? ` · Class ${item.className}` : ''}
        {item.periodIndex ? ` · Period ${item.periodIndex}` : ''}
      </p>
    </li>
  );
}
