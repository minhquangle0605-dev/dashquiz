import type { Question } from '@/types/question';

import { DifficultyBadge } from './DifficultyBadge';

export interface QuestionCardProps {
  question: Question;
  showAnswer?: boolean;
  /** Selected option id (multiple choice). */
  selectedOption?: string;
  className?: string;
}

export function QuestionCard({
  question,
  showAnswer = false,
  selectedOption,
  className = '',
}: QuestionCardProps) {
  return (
    <article
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DifficultyBadge level={question.difficulty} />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {question.type.replace('_', ' ')}
        </span>
        <span className="text-xs text-slate-500">{question.points} pts</span>
      </div>
      <p className="text-base font-medium text-slate-900">{question.prompt}</p>

      {question.options !== undefined && question.options.length > 0 && (
        <ul className="mt-4 space-y-2">
          {question.options.map((opt) => {
            const isSelected = opt.id === selectedOption;
            const showCorrect = showAnswer && opt.isCorrect === true;
            const showWrongSelected =
              showAnswer && isSelected && opt.isCorrect === false;

            let row =
              'rounded-lg border px-3 py-2.5 text-sm transition-colors border-slate-200 bg-white text-slate-800';
            if (showCorrect) {
              row =
                'rounded-lg border px-3 py-2.5 text-sm transition-colors border-emerald-500 bg-emerald-50 text-emerald-900';
            } else if (showWrongSelected) {
              row =
                'rounded-lg border px-3 py-2.5 text-sm transition-colors border-red-500 bg-red-50 text-red-900';
            } else if (isSelected && !showAnswer) {
              row =
                'rounded-lg border px-3 py-2.5 text-sm transition-colors border-indigo-500 bg-indigo-50 text-indigo-900';
            }

            return (
              <li
                key={opt.id}
                className={row}
              >
                <span className="font-medium text-slate-600">{opt.label}.</span>{' '}
                {opt.text}
              </li>
            );
          })}
        </ul>
      )}

      {showAnswer &&
        question.explanation !== undefined &&
        question.explanation !== '' && (
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-800">Explanation: </span>
            {question.explanation}
          </p>
        )}
    </article>
  );
}
