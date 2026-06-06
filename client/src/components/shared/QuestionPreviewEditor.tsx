import type { ReactNode } from 'react';
import { MathText } from './MathText';
import type {
  DuplicateMatch,
  ImportPreviewItemStatus,
  ImportValidationResult,
  NormalizedImportOption,
  NormalizedImportQuestion,
  QuestionKind,
} from '@/types/question';

const DIFFICULTY_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

const QUESTION_TYPE_LABELS: Record<QuestionKind, string> = {
  SINGLE_CHOICE: 'Single choice',
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short answer',
  MATCHING: 'Matching',
};

function labelFromIndex(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function relabelOptions(options: NormalizedImportOption[]): NormalizedImportOption[] {
  return options.map((option, index) => ({ ...option, label: labelFromIndex(index) }));
}

function makeOption(index: number, content = '', isCorrect = false): NormalizedImportOption {
  return { label: labelFromIndex(index), content, isCorrect, imageUrl: null };
}

function splitMatchingPair(content: string): { left: string; right: string } {
  const [left = '', ...rest] = content.split(/\s*=>\s*/);
  return { left: left.trim(), right: rest.join(' => ').trim() };
}

function formatMatchingPair(left: string, right: string): string {
  return `${left.trim()} => ${right.trim()}`.trim();
}

function ImageThumb({ url, label }: { url?: string | null; label: string }) {
  if (!url) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <img
        src={url}
        alt={label}
        loading="lazy"
        className="max-h-40 max-w-full rounded border border-slate-200 object-contain"
      />
    </div>
  );
}

export interface QuestionPreviewEditorProps {
  index: number;
  question: NormalizedImportQuestion;
  validation?: ImportValidationResult;
  status?: ImportPreviewItemStatus;
  sourceLine?: number | null;
  selected?: boolean;
  saving?: boolean;
  duplicates?: DuplicateMatch[];
  aiLoading?: boolean;
  aiPanel?: ReactNode;
  onSelectChange?: (selected: boolean) => void;
  onChange: (question: NormalizedImportQuestion) => void;
  onSkip?: () => void;
  onAiSuggest?: () => void;
}

/**
 * Editable card for one extracted/preview question. Shared by the import wizard so
 * teachers can repair a question inline without leaving the flow (PDF §15). Pure
 * presentational: it never calls the API — the parent persists changes.
 */
export function QuestionPreviewEditor({
  index,
  question,
  validation,
  status,
  sourceLine,
  selected,
  saving,
  duplicates,
  aiLoading,
  aiPanel,
  onSelectChange,
  onChange,
  onSkip,
  onAiSuggest,
}: QuestionPreviewEditorProps) {
  const isChoice =
    question.questionType === 'SINGLE_CHOICE' ||
    question.questionType === 'MULTIPLE_CHOICE' ||
    question.questionType === 'TRUE_FALSE';
  const isMultiple = question.questionType === 'MULTIPLE_CHOICE';

  const critical = validation?.critical ?? [];
  const warnings = validation?.warnings ?? [];
  const committed = status === 'COMMITTED';

  const patch = (changes: Partial<NormalizedImportQuestion>) => onChange({ ...question, ...changes });

  const updateOption = (optionIndex: number, change: Partial<NormalizedImportOption>) => {
    const single =
      question.questionType === 'SINGLE_CHOICE' || question.questionType === 'TRUE_FALSE';
    const options = question.options.map((option, i) => {
      if (i !== optionIndex) {
        if (change.isCorrect && single) return { ...option, isCorrect: false };
        return option;
      }
      return { ...option, ...change };
    });
    patch({ options });
  };

  const changeType = (questionType: QuestionKind) => {
    let options = question.options;
    if (questionType === 'TRUE_FALSE') {
      const existingCorrect = options.find((o) => o.isCorrect)?.label;
      options = [
        { label: 'A', content: 'True', isCorrect: existingCorrect !== 'B', imageUrl: null },
        { label: 'B', content: 'False', isCorrect: existingCorrect === 'B', imageUrl: null },
      ];
    } else if (questionType === 'SHORT_ANSWER') {
      options =
        options.length > 0
          ? relabelOptions(options.map((o) => ({ ...o, isCorrect: true })))
          : [makeOption(0, '', true)];
    } else if (questionType === 'MATCHING') {
      options =
        options.length >= 2
          ? relabelOptions(options.map((o) => ({ ...o, isCorrect: true })))
          : [makeOption(0, 'Left 1 => Right 1', true), makeOption(1, 'Left 2 => Right 2', true)];
    } else {
      options = options.length >= 2 ? relabelOptions(options) : [makeOption(0), makeOption(1)];
      if (questionType === 'SINGLE_CHOICE') {
        const firstCorrect = options.findIndex((o) => o.isCorrect);
        options = options.map((o, i) => ({ ...o, isCorrect: i === (firstCorrect >= 0 ? firstCorrect : 0) }));
      }
    }
    onChange({ ...question, questionType, options });
  };

  const addOption = () => {
    const next =
      question.questionType === 'MATCHING'
        ? makeOption(question.options.length, 'Left => Right', true)
        : makeOption(question.options.length, '', question.questionType === 'SHORT_ANSWER');
    patch({ options: [...question.options, next] });
  };

  const removeOption = (optionIndex: number) => {
    patch({ options: relabelOptions(question.options.filter((_, i) => i !== optionIndex)) });
  };

  const borderClass = committed
    ? 'border-emerald-300'
    : critical.length > 0
      ? 'border-red-300'
      : warnings.length > 0
        ? 'border-amber-300'
        : 'border-slate-200';

  return (
    <div className={`rounded-xl border bg-white p-4 ${borderClass}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          {onSelectChange && !committed && (
            <input
              type="checkbox"
              checked={Boolean(selected)}
              disabled={critical.length > 0}
              onChange={(e) => onSelectChange(e.target.checked)}
              className="h-4 w-4 rounded text-indigo-600 disabled:opacity-40"
              title={critical.length > 0 ? 'Fix critical errors before selecting' : 'Select to import'}
            />
          )}
          <span>Question #{index + 1}</span>
          <span className="rounded bg-slate-100 px-2 py-0.5">
            {QUESTION_TYPE_LABELS[question.questionType]}
          </span>
          {sourceLine ? <span className="rounded bg-slate-100 px-2 py-0.5">line {sourceLine}</span> : null}
          {typeof validation?.confidence === 'number' && (
            <span className="rounded bg-slate-100 px-2 py-0.5">
              {Math.round(validation.confidence * 100)}% conf.
            </span>
          )}
          {committed && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">saved</span>
          )}
          {!committed && critical.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">needs review</span>
          )}
          {saving && <span className="text-slate-400">saving…</span>}
        </div>
        <div className="flex items-center gap-3">
          {onAiSuggest && !committed && (
            <button
              type="button"
              onClick={onAiSuggest}
              disabled={aiLoading}
              className="text-xs font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
            >
              {aiLoading ? 'Thinking…' : '✨ AI suggest'}
            </button>
          )}
          {onSkip && !committed && (
            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-medium text-red-600 hover:text-red-500"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      <fieldset disabled={committed} className="space-y-3 disabled:opacity-70">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_150px]">
          <textarea
            className="min-h-[78px] w-full resize-y rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={question.content}
            onChange={(e) => patch({ content: e.target.value })}
            placeholder="Question content"
          />
          <select
            value={question.questionType}
            onChange={(e) => changeType(e.target.value as QuestionKind)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={question.difficulty}
            onChange={(e) => patch({ difficulty: Number(e.target.value) })}
            className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d} - {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>

        <ImageThumb url={question.questionImageUrl} label="Question image" />

        {question.content.includes('$') && (
          <div className="rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700">
            <MathText>{question.content}</MathText>
          </div>
        )}

        <div className="space-y-2">
          {isChoice &&
            question.options.map((option, optionIndex) => (
              <div
                key={optionIndex}
                className={`rounded-lg border px-3 py-2 ${
                  option.isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type={isMultiple ? 'checkbox' : 'radio'}
                    name={`correct-${index}`}
                    checked={option.isCorrect}
                    onChange={() => updateOption(optionIndex, { isCorrect: isMultiple ? !option.isCorrect : true })}
                    className="mt-2 h-4 w-4 text-emerald-600"
                  />
                  <span
                    className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${
                      option.isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {option.label}
                  </span>
                  <input
                    type="text"
                    value={option.content}
                    disabled={question.questionType === 'TRUE_FALSE'}
                    onChange={(e) => updateOption(optionIndex, { content: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 disabled:bg-slate-50"
                    placeholder={`Option ${option.label}`}
                  />
                  {question.questionType !== 'TRUE_FALSE' && question.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(optionIndex)}
                      className="mt-1 text-xs font-medium text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <ImageThumb url={option.imageUrl} label={`Option ${option.label} image`} />
              </div>
            ))}

          {question.questionType === 'SHORT_ANSWER' &&
            question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-600">
                  {option.label}
                </span>
                <input
                  type="text"
                  value={option.content}
                  onChange={(e) => updateOption(optionIndex, { content: e.target.value, isCorrect: true })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Accepted answer"
                />
                {question.options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOption(optionIndex)}
                    className="text-xs font-medium text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

          {question.questionType === 'MATCHING' &&
            question.options.map((option, optionIndex) => {
              const pair = splitMatchingPair(option.content);
              return (
                <div key={optionIndex} className="grid items-center gap-2 sm:grid-cols-[32px_1fr_1fr_auto]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-600">
                    {option.label}
                  </span>
                  <input
                    type="text"
                    value={pair.left}
                    onChange={(e) =>
                      updateOption(optionIndex, {
                        content: formatMatchingPair(e.target.value, pair.right),
                        isCorrect: true,
                      })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Left item"
                  />
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) =>
                      updateOption(optionIndex, {
                        content: formatMatchingPair(pair.left, e.target.value),
                        isCorrect: true,
                      })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Right answer"
                  />
                  {question.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(optionIndex)}
                      className="text-xs font-medium text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
        </div>

        {question.questionType !== 'TRUE_FALSE' && (
          <button
            type="button"
            onClick={addOption}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Add answer row
          </button>
        )}

        <div>
          <input
            type="text"
            value={question.explanation || ''}
            onChange={(e) => patch({ explanation: e.target.value || null })}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Explanation (optional)"
          />
          <ImageThumb url={question.explanationImageUrl} label="Explanation image" />
        </div>
      </fieldset>

      {critical.length > 0 && (
        <div className="mt-3 space-y-1 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {critical.map((message, i) => (
            <p key={i}>⛔ {message}</p>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {warnings.map((message, i) => (
            <p key={i}>⚠ {message}</p>
          ))}
        </div>
      )}

      {duplicates && duplicates.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg border border-orange-300 bg-orange-50 p-2 text-xs text-orange-800">
          <p className="font-semibold">
            Possible duplicate{duplicates.length > 1 ? 's' : ''} already in the question bank:
          </p>
          {duplicates.map((d) => (
            <p key={d.questionId}>
              <span className="font-medium">
                {Math.round(d.similarity * 100)}% {d.method}
              </span>{' '}
              — {d.contentPreview}
            </p>
          ))}
          {onSkip && !committed && (
            <button
              type="button"
              onClick={onSkip}
              className="font-semibold text-orange-700 underline hover:text-orange-600"
            >
              Skip this as a duplicate
            </button>
          )}
        </div>
      )}

      {aiPanel && <div className="mt-2">{aiPanel}</div>}
    </div>
  );
}
