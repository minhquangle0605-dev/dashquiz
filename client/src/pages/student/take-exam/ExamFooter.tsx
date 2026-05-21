import { Button } from '@/components/ui/Button';

interface ExamFooterProps {
  currentIndex: number;
  total: number;
  isFlagged: boolean;
  isSubmitting: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleFlag: () => void;
  onOpenSubmit: () => void;
}

export function ExamFooter({
  currentIndex,
  total,
  isFlagged,
  isSubmitting,
  onPrev,
  onNext,
  onToggleFlag,
  onOpenSubmit,
}: ExamFooterProps) {
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-4 py-3 shadow-[0_-2px_8px_rgba(15,23,42,0.04)] sm:px-6">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="md"
          disabled={currentIndex === 0}
          onClick={onPrev}
          leftIcon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          }
        >
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={currentIndex === total - 1}
          onClick={onNext}
          rightIcon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          }
        >
          <span className="hidden sm:inline">Next</span>
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant={isFlagged ? 'subtle' : 'ghost'}
          size="md"
          onClick={onToggleFlag}
          leftIcon={
            isFlagged ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.77l-.108-.054a8.25 8.25 0 00-5.69-.625l-1.81.452A.75.75 0 013 14.175V3A.75.75 0 013.75 2.25z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
            )
          }
        >
          <span className="hidden sm:inline">{isFlagged ? 'Unflag' : 'Flag'}</span>
        </Button>

        <Button
          variant="primary"
          size="md"
          onClick={onOpenSubmit}
          isLoading={isSubmitting}
        >
          Submit Exam
        </Button>
      </div>
    </footer>
  );
}
