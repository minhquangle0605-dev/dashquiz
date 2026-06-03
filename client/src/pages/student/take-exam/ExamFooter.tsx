import { Button } from '@/components/ui/Button';

interface ExamFooterProps {
  canPrev: boolean;
  canNext: boolean;
  pageLabel?: string;
  isSubmitting: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenSubmit: () => void;
}

export function ExamFooter({
  canPrev,
  canNext,
  pageLabel,
  isSubmitting,
  onPrev,
  onNext,
  onOpenSubmit,
}: ExamFooterProps) {
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-4 py-3 shadow-[0_-2px_8px_rgba(15,23,42,0.04)] sm:px-6">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="md"
          disabled={!canPrev}
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
          disabled={!canNext}
          onClick={onNext}
          rightIcon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          }
        >
          <span className="hidden sm:inline">Next</span>
        </Button>
        {pageLabel && (
          <span className="ml-1 hidden text-xs font-medium tabular-nums text-[var(--color-text-muted)] sm:inline">
            {pageLabel}
          </span>
        )}
      </div>

      <Button
        variant="primary"
        size="md"
        onClick={onOpenSubmit}
        isLoading={isSubmitting}
      >
        Submit Exam
      </Button>
    </footer>
  );
}
