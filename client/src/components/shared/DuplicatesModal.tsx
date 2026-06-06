import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { listDuplicateClusters, resolveDuplicate } from '@/services/importJob.api';
import type { DuplicatePair } from '@/types/question';

export interface DuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional subject filter (uses the current question-bank subject). */
  subjectId?: number;
  /** Called after a question is deleted so the bank list can refresh. */
  onChanged?: () => void;
}

function pairKey(p: DuplicatePair): string {
  return `${p.a.id}-${p.b.id}`;
}

/**
 * Bank-level near-duplicate review (PDF §10 duplicate clusters). Lists similar
 * question pairs and lets the teacher keep both, dismiss, or delete one. Never
 * auto-deletes (PDF §16).
 */
export function DuplicatesModal({ isOpen, onClose, subjectId, onChanged }: DuplicatesModalProps) {
  const [loading, setLoading] = useState(false);
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPairs(await listDuplicateClusters(subjectId));
    } catch {
      toast.error('Could not load duplicates.');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  const act = async (
    pair: DuplicatePair,
    action: 'acceptable' | 'dismiss' | 'delete',
    deleteId?: number,
  ) => {
    const key = pairKey(pair);
    setBusyKey(key);
    try {
      await resolveDuplicate({
        questionId: action === 'delete' && deleteId === pair.a.id ? pair.b.id : pair.a.id,
        duplicateQuestionId:
          action === 'delete' ? (deleteId ?? pair.b.id) : pair.b.id,
        action,
      });
      setPairs((prev) => prev.filter((p) => pairKey(p) !== key));
      if (action === 'delete') {
        toast.success('Question deleted.');
        onChanged?.();
      } else {
        toast.success(action === 'acceptable' ? 'Marked as acceptable.' : 'Dismissed.');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Duplicate Questions" size="lg" className="!max-w-5xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Near-duplicate questions{subjectId ? ' in the selected subject' : ''}, most similar first.
          Resolved pairs will not appear again.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : pairs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No near-duplicate questions found. 🎉</p>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {pairs.map((pair) => {
              const key = pairKey(pair);
              const busy = busyKey === key;
              return (
                <div key={key} className="rounded-xl border border-orange-200 bg-orange-50/40 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                      {Math.round(pair.similarity * 100)}% similar
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[pair.a, pair.b].map((q, idx) => (
                      <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Question #{q.id} · {q.questionType.replace('_', ' ').toLowerCase()}
                        </p>
                        <p className="text-sm text-slate-700">{q.contentPreview}</p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act(pair, 'delete', idx === 0 ? pair.a.id : pair.b.id)}
                          className="mt-2 text-xs font-semibold text-red-600 hover:text-red-500 disabled:opacity-40"
                        >
                          Delete this one
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-3 text-xs">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(pair, 'acceptable')}
                      className="font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-40"
                    >
                      Keep both (acceptable)
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(pair, 'dismiss')}
                      className="font-medium text-slate-400 hover:text-slate-600 disabled:opacity-40"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
