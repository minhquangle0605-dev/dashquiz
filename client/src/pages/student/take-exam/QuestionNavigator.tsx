import type { ExamQuestion, StudentAnswerValue } from '@/types/exam';

interface QuestionNavigatorProps {
  questions: ExamQuestion[];
  answers: Record<string, StudentAnswerValue>;
  flagged: Set<number>;
  currentIndex: number;
  sidebarOpen: boolean;
  unansweredCount: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

function isQuestionAnswered(question: ExamQuestion, value: StudentAnswerValue) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') {
    const pairLabels = question.options
      .filter((opt) => opt.content.includes('=>'))
      .map((opt) => opt.label);
    if (pairLabels.length === 0) return false;
    return pairLabels.every((label) => String(value[label] || '').trim());
  }
  return true;
}

export function QuestionNavigator({
  questions,
  answers,
  flagged,
  currentIndex,
  sidebarOpen,
  unansweredCount,
  onSelect,
  onClose,
}: QuestionNavigatorProps) {
  const answeredCount = questions.length - unansweredCount;

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/55 backdrop-blur-sm animate-fade-in lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-40 h-full w-80 bg-[var(--color-bg-card)] border-l border-[var(--color-border)] shadow-2xl transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-72 lg:translate-x-0 lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
            <h2 className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
              Question Navigator
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)] lg:hidden"
              aria-label="Close navigator"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary card */}
          <div className="border-b border-[var(--color-border-subtle)] px-4 py-3">
            <div className="rounded-xl bg-gradient-brand-soft p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
                <span>Progress</span>
                <span className="text-[var(--color-primary)]">
                  {answeredCount}/{questions.length}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-card)]">
                <div
                  className="h-full rounded-full bg-gradient-brand transition-[width] duration-300"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-1.5 border-b border-[var(--color-border-subtle)] px-4 py-2.5 text-[11px] font-medium text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-[var(--color-bg-muted)] ring-1 ring-inset ring-[var(--color-border)]" /> Empty
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-[var(--color-primary)]" /> Answered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-[var(--color-warning)]" /> Flagged
            </span>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, i) => {
                const answered = isQuestionAnswered(q, answers[String(q.questionId)]);
                const isFlagged = flagged.has(i);
                const isCurrent = i === currentIndex;

                let cls =
                  'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]';
                if (isFlagged) {
                  cls =
                    'bg-[var(--color-warning-soft)] text-[var(--color-warning)] hover:brightness-95 ring-1 ring-inset ring-[var(--color-warning)]/30';
                } else if (answered) {
                  cls = 'bg-[var(--color-primary)] text-white hover:brightness-110 shadow-sm';
                }

                return (
                  <button
                    key={q.questionId}
                    type="button"
                    onClick={() => onSelect(i)}
                    className={`relative flex h-10 w-full items-center justify-center rounded-lg text-sm font-bold tabular-nums transition-all duration-150 will-change-transform active:scale-95 focus-ring-brand ${cls} ${
                      isCurrent ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-bg-card)]' : ''
                    }`}
                  >
                    {i + 1}
                    {isFlagged && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-warning)] ring-2 ring-[var(--color-bg-card)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats footer */}
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border-subtle)] p-4 text-xs">
            <div className="rounded-lg bg-[var(--color-bg-subtle)] p-3">
              <p className="text-[var(--color-text-muted)]">Answered</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-success)]">
                {answeredCount}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--color-bg-subtle)] p-3">
              <p className="text-[var(--color-text-muted)]">Flagged</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[var(--color-warning)]">
                {flagged.size}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
