import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useStudentExams, useStartStudentExam } from '@/hooks/useExam';
import { formatDate } from '@/utils/format';
import { GRADING_METHOD_LABELS, type StudentExamItem } from '@/types/exam';

function phaseBadge(phase: StudentExamItem['phase']): {
  variant: BadgeVariant;
  label: string;
} {
  switch (phase) {
    case 'upcoming':
      return { variant: 'info', label: 'Upcoming' };
    case 'in_progress':
      return { variant: 'warning', label: 'In Progress' };
    case 'completed':
      return { variant: 'success', label: 'Completed' };
    default:
      return { variant: 'neutral', label: phase };
  }
}

function InfoTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)] [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-bold text-[var(--color-text-primary)]">
          {value}
        </p>
        {hint && (
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{hint}</p>
        )}
      </div>
    </div>
  );
}

const RULES: { icon: ReactNode; text: string }[] = [
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: 'The timer starts as soon as you begin and keeps running — even if you close the tab. The exam submits automatically when time runs out.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    text: 'Your answers are saved automatically every 30 seconds. You can leave and resume the same attempt without losing progress.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
    text: 'Switching tabs or windows is recorded and may be reviewed by your teacher. Stay on the exam page until you submit.',
  },
  {
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
      </svg>
    ),
    text: 'A stable internet connection is recommended. If you go offline, the app keeps retrying — reconnect to resume saving.',
  },
];

export default function ExamLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const examId = Number(id);

  const stateExam = (location.state as { exam?: StudentExamItem } | null)?.exam;
  const { data, isLoading, isError } = useStudentExams({ limit: 100 });
  const exam =
    stateExam?.id === examId
      ? stateExam
      : data?.data.find((e) => e.id === examId);

  const startMutation = useStartStudentExam();

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Loading: waiting on the list while we have no router-state fallback.
  if (!exam && isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-[var(--color-text-muted)]">
            Loading exam…
          </p>
        </div>
      </div>
    );
  }

  // Not found / not assigned / failed to load.
  if (!exam) {
    return (
      <div className="mx-auto mt-16 max-w-lg animate-fade-in-up">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center shadow-[var(--shadow-md)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
            {isError ? 'Could not load this exam' : 'Exam not found'}
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {isError
              ? 'Something went wrong while loading the exam. Please try again.'
              : "This exam is not available, or it hasn't been assigned to you."}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => navigate('/student/exams')}>
            Back to Exams
          </Button>
        </div>
      </div>
    );
  }

  const badge = phaseBadge(exam.phase);
  const schedule = exam.examSchedules?.[0];
  const questionCount = exam._count?.examQuestions ?? exam.totalQuestions;
  const usedAttempts = exam.completedCount;

  const goToRunner = () =>
    navigate(`/student/exams/${exam.id}/take`);

  const handleStart = async () => {
    // Password-protected exams unlock inside the runner (a pre-start would 403),
    // so route straight there and let the runner gate on the password.
    if (exam.hasPassword) {
      goToRunner();
      return;
    }
    try {
      await startMutation.mutateAsync({ examId: exam.id });
      goToRunner();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start exam';
      toast.error(msg);
    }
  };

  // Mirror ExamListPage CTA precedence: resume → start → view results → locked.
  let cta: ReactNode;
  if (exam.hasInProgress) {
    cta = (
      <Button variant="primary" size="lg" fullWidth onClick={goToRunner}>
        Resume exam
      </Button>
    );
  } else if (exam.canStart) {
    cta = (
      <Button
        variant="primary"
        size="lg"
        fullWidth
        isLoading={startMutation.isPending}
        onClick={handleStart}
      >
        Start exam
      </Button>
    );
  } else if (exam.phase === 'completed') {
    // The result page is keyed by attemptId (not examId); use the most recent
    // finished attempt the list payload reports.
    cta =
      exam.lastAttemptId != null ? (
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={() => navigate(`/student/attempts/${exam.lastAttemptId}/result`)}
        >
          View results
        </Button>
      ) : (
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={() => navigate('/student/exams')}
        >
          Back to Exams
        </Button>
      );
  } else {
    cta = (
      <Button variant="secondary" size="lg" fullWidth disabled>
        Not yet available
      </Button>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate('/student/exams')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] focus-ring-brand rounded-lg"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Exams
      </button>

      {/* Header */}
      <Card variant="gradient" padding="lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              {exam.title}
            </h1>
            <p className="mt-1 text-sm font-medium text-[var(--color-text-muted)]">
              {exam.subject ? exam.subject.name : 'No subject'}
              {exam.creator ? ` · ${exam.creator.fullName}` : ''}
            </p>
          </div>
          <Badge variant={badge.variant} dot>{badge.label}</Badge>
        </div>
      </Card>

      {/* Key facts */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoTile
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Duration"
          value={`${exam.durationMin} min`}
        />
        <InfoTile
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Questions"
          value={`${questionCount} questions`}
        />
        <InfoTile
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          }
          label="Attempts"
          value={
            exam.maxAttempts > 0
              ? `${usedAttempts} / ${exam.maxAttempts} used`
              : 'Unlimited'
          }
          hint={
            exam.maxAttempts > 0
              ? `${exam.attemptsRemaining} remaining`
              : undefined
          }
        />
        <InfoTile
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          }
          label="Grading"
          value={GRADING_METHOD_LABELS[exam.gradingMethod] ?? exam.gradingMethod}
          hint={
            exam.passingScore != null
              ? `Pass mark: ${exam.passingScore}`
              : undefined
          }
        />
      </div>

      {/* Schedule window */}
      {schedule && (
        <Card padding="md">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)] [&>svg]:h-5 [&>svg]:w-5">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Availability window
              </p>
              <p className="mt-0.5 text-sm font-bold text-[var(--color-text-primary)]">
                {formatDate(schedule.startTime, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' — '}
                {formatDate(schedule.endTime, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Status notices: password, in-progress, result visibility */}
      <div className="space-y-3">
        {exam.hasPassword && (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            <svg className="h-5 w-5 shrink-0 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span>
              This exam is <strong className="font-semibold text-[var(--color-text-primary)]">password-protected</strong>. You'll be asked for the password from your teacher right after you start.
            </span>
          </div>
        )}

        {exam.hasInProgress && (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            <svg className="h-5 w-5 shrink-0 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M12 8v4l2.5 2.5" />
            </svg>
            <span>
              You have an attempt <strong className="font-semibold text-[var(--color-text-primary)]">in progress</strong>. Resume to continue where you left off — your timer has kept running.
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          <svg className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>
            {exam.showResult
              ? 'Your score and review will be available after you submit (depending on your teacher’s settings).'
              : 'Results for this exam are hidden. Your teacher controls when scores become visible.'}
          </span>
        </div>
      </div>

      {/* Device / network check */}
      <Card padding="md">
        <h2 className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
          Before you begin
        </h2>

        <div
          className={`mt-3 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            isOnline
              ? 'border-[var(--color-success)]/30 bg-[var(--color-success-soft)] text-[var(--color-success)]'
              : 'border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isOnline ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)] animate-pulse-ring'
            }`}
            aria-hidden
          />
          <span className="font-semibold">
            {isOnline
              ? 'Your connection looks good.'
              : 'You appear to be offline. Reconnect before starting.'}
          </span>
        </div>

        <ul className="mt-4 space-y-3">
          {RULES.map((rule, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-[var(--color-text-secondary)]">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-muted)] text-[var(--color-text-muted)] [&>svg]:h-4 [&>svg]:w-4">
                {rule.icon}
              </span>
              <span>{rule.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* CTA */}
      <div className="sticky bottom-0 -mx-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-page)]/80 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {cta}
      </div>
    </div>
  );
}
