import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MathText } from './MathText';
import { getQuestionVersions, restoreQuestionVersion } from '@/services/question.api';
import type { Question, QuestionVersion } from '@/types/question';

export interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
  /** Called after a restore so the bank list can refresh. */
  onRestored?: () => void;
}

const DIFFICULTY_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

/** View a question's saved versions and restore a previous one (PDF §8/P2). */
export function VersionHistoryModal({ isOpen, onClose, question, onRestored }: VersionHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<QuestionVersion[]>([]);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!question) return;
    setLoading(true);
    try {
      setVersions(await getQuestionVersions(question.id));
    } catch {
      toast.error('Could not load version history.');
    } finally {
      setLoading(false);
    }
  }, [question]);

  useEffect(() => {
    if (isOpen && question) void load();
  }, [isOpen, question, load]);

  const handleRestore = async (versionId: number) => {
    if (!question) return;
    if (!window.confirm('Restore this version? The current content will be saved as a new version first.')) {
      return;
    }
    setRestoringId(versionId);
    try {
      await restoreQuestionVersion(question.id, versionId);
      toast.success('Version restored.');
      onRestored?.();
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Restore failed.');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Version History" size="lg" className="!max-w-3xl">
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : versions.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No versions recorded.</p>
      ) : (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {versions.map((v, idx) => (
            <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="rounded bg-slate-100 px-2 py-0.5">v{v.versionNo}</span>
                  {idx === 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">current</span>
                  )}
                  <span>{v.questionType.replace('_', ' ')}</span>
                  <span>{DIFFICULTY_LABELS[v.difficulty] ?? `Difficulty ${v.difficulty}`}</span>
                  {v.changeReason && <span className="text-slate-400">· {v.changeReason}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{new Date(v.createdAt).toLocaleString()}</span>
                  {v.changer?.fullName && <span>by {v.changer.fullName}</span>}
                  {idx !== 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={restoringId === v.id}
                      onClick={() => handleRestore(v.id)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-sm text-slate-700 line-clamp-3">
                <MathText>{v.content}</MathText>
              </div>
              {Array.isArray(v.optionsJson) && v.optionsJson.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.optionsJson.map((o, i) => (
                    <span
                      key={i}
                      className={`rounded px-2 py-0.5 text-xs ${
                        o.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {o.label}. {o.content.replace(/<[^>]+>/g, ' ').slice(0, 30)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
