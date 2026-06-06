import type { AiSuggestion } from '@/types/question';

const DIFFICULTY_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

export interface AiSuggestionPanelProps {
  suggestion: AiSuggestion;
  current?: { difficulty?: number; explanation?: string | null };
  onApplyDifficulty?: (difficulty: number) => void;
  onApplyExplanation?: (text: string) => void;
  onApplyTags?: (tags: string[]) => void;
  onApplyTopic?: (topic: string) => void;
  onDismiss?: () => void;
}

const chip =
  'inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200';
const applyBtn = 'rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-violet-500';

/**
 * Renders AI enrichment suggestions as reviewable chips (PDF §6 "suggestion chips,
 * bulk accept/reject"). The teacher applies each suggestion explicitly — nothing
 * is auto-saved.
 */
export function AiSuggestionPanel({
  suggestion,
  current,
  onApplyDifficulty,
  onApplyExplanation,
  onApplyTags,
  onApplyTopic,
  onDismiss,
}: AiSuggestionPanelProps) {
  if (!suggestion.available) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500">
        AI suggestions are not configured on this server.
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="ml-2 font-semibold text-slate-400 underline">
            Hide
          </button>
        )}
      </div>
    );
  }

  const hasAnything =
    suggestion.difficulty !== undefined ||
    (suggestion.tags?.length ?? 0) > 0 ||
    suggestion.topic ||
    suggestion.explanation ||
    (suggestion.weakDistractors?.length ?? 0) > 0 ||
    suggestion.notes;

  return (
    <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-2.5 text-xs text-violet-900">
      <div className="flex items-center justify-between">
        <span className="font-semibold">✨ AI suggestions (review before applying)</span>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="font-semibold text-violet-400 underline">
            Hide
          </button>
        )}
      </div>

      {!hasAnything && <p className="text-violet-500">No suggestions returned.</p>}

      <div className="flex flex-wrap items-center gap-2">
        {suggestion.difficulty !== undefined && (
          <span className={chip}>
            Difficulty: {suggestion.difficulty} — {DIFFICULTY_LABELS[suggestion.difficulty]}
            {onApplyDifficulty && current?.difficulty !== suggestion.difficulty && (
              <button type="button" className={applyBtn} onClick={() => onApplyDifficulty(suggestion.difficulty!)}>
                Apply
              </button>
            )}
          </span>
        )}
        {suggestion.topic && (
          <span className={chip}>
            Topic: {suggestion.topic}
            {onApplyTopic && (
              <button type="button" className={applyBtn} onClick={() => onApplyTopic(suggestion.topic!)}>
                Apply
              </button>
            )}
          </span>
        )}
      </div>

      {suggestion.tags && suggestion.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-violet-500">Tags:</span>
          {suggestion.tags.map((t) => (
            <span key={t} className={chip}>
              {t}
            </span>
          ))}
          {onApplyTags && (
            <button type="button" className={applyBtn} onClick={() => onApplyTags(suggestion.tags!)}>
              Apply all
            </button>
          )}
        </div>
      )}

      {suggestion.explanation && (
        <div className="rounded border border-violet-200 bg-white p-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-400">
            Suggested explanation
          </p>
          <p className="text-violet-800">{suggestion.explanation}</p>
          {onApplyExplanation && (
            <button
              type="button"
              className="mt-1 rounded bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-violet-500"
              onClick={() => onApplyExplanation(suggestion.explanation!)}
            >
              Use this explanation
            </button>
          )}
        </div>
      )}

      {suggestion.weakDistractors && suggestion.weakDistractors.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400">
            Weak distractors
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {suggestion.weakDistractors.map((d, i) => (
              <li key={i}>
                <span className="font-semibold">Option {d.label}:</span> {d.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestion.notes && <p className="italic text-violet-600">{suggestion.notes}</p>}
    </div>
  );
}
