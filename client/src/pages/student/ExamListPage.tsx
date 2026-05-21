import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useStudentExams, useStartStudentExam } from '@/hooks/useExam';
import { formatDate } from '@/utils/format';
import type { StudentExamItem } from '@/types/exam';

type FilterTab = 'all' | 'upcoming' | 'in_progress' | 'completed';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

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

const phaseBarClass: Record<StudentExamItem['phase'], string> = {
  upcoming: 'bg-gradient-to-r from-sky-500 to-cyan-500',
  in_progress: 'bg-gradient-to-r from-amber-500 to-orange-500',
  completed: 'bg-gradient-to-r from-emerald-500 to-teal-500',
};

function ExamCard({ exam }: { exam: StudentExamItem }) {
  const navigate = useNavigate();
  const startMutation = useStartStudentExam();
  const badge = phaseBadge(exam.phase);
  const schedule = exam.examSchedules?.[0];

  const handleStart = async () => {
    try {
      await startMutation.mutateAsync(exam.id);
      navigate(`/student/exams/${exam.id}/take`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start exam';
      toast.error(msg);
    }
  };

  const handleResume = () => {
    navigate(`/student/exams/${exam.id}/take`);
  };

  return (
    <Card padding="none" className="card-lift overflow-hidden">
      <div className="flex h-full flex-col">
        <div className={`h-1.5 w-full ${phaseBarClass[exam.phase]}`} />

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-[var(--color-text-primary)]">
                {exam.title}
              </h3>
              {exam.subject && (
                <p className="mt-1 text-sm font-medium text-[var(--color-text-muted)]">
                  {exam.subject.name}
                </p>
              )}
            </div>
            <Badge variant={badge.variant} dot>{badge.label}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <svg className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="tabular-nums">{exam.durationMin} min</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <svg className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="tabular-nums">{exam._count.examQuestions} câu</span>
            </div>
            {schedule && (
              <div className="col-span-2 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <svg className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span>
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
                </span>
              </div>
            )}
            {exam.phase === 'completed' && exam.bestScore !== null && (
              <div className="col-span-2 flex items-center justify-between rounded-lg bg-[var(--color-success-soft)] px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-success)]">
                  <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="tabular-nums">{exam.bestScore} pts</span>
                </div>
                <span className="text-xs font-medium text-[var(--color-success)]/80">
                  {exam.completedCount}/{exam.maxAttempts} attempts
                </span>
              </div>
            )}
          </div>

          <div className="flex-1" />

          <div className="border-t border-[var(--color-border-subtle)] pt-3">
            {exam.hasInProgress ? (
              <Button variant="primary" size="md" fullWidth onClick={handleResume}>
                Tiếp tục làm bài
              </Button>
            ) : exam.canStart ? (
              <Button
                variant="primary"
                size="md"
                fullWidth
                isLoading={startMutation.isPending}
                onClick={handleStart}
              >
                Bắt đầu
              </Button>
            ) : exam.phase === 'completed' ? (
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={() => navigate(`/student/exams/${exam.id}/result`)}
              >
                Xem kết quả
              </Button>
            ) : (
              <Button variant="secondary" size="md" fullWidth disabled>
                Chưa khả dụng
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ExamListPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const { data, isLoading, isError, error } = useStudentExams({
    filter: activeTab === 'all' ? undefined : activeTab,
    limit: 50,
  });

  const exams = data?.data ?? [];

  const grouped = useMemo(() => {
    if (activeTab !== 'all') return null;
    return {
      in_progress: exams.filter((e) => e.phase === 'in_progress'),
      upcoming: exams.filter((e) => e.phase === 'upcoming'),
      completed: exams.filter((e) => e.phase === 'completed'),
    };
  }, [exams, activeTab]);

  const tabCounts = useMemo(() => {
    return {
      in_progress: exams.filter((e) => e.phase === 'in_progress').length,
      upcoming: exams.filter((e) => e.phase === 'upcoming').length,
      completed: exams.filter((e) => e.phase === 'completed').length,
    };
  }, [exams]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
          Bài thi của tôi
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Xem và làm các bài thi được giao
        </p>
      </div>

      {/* Tabs */}
      <div className="inline-flex w-full overflow-x-auto rounded-2xl bg-[var(--color-bg-muted)] p-1 sm:w-auto">
        {TABS.map((tab) => {
          const count =
            tab.key === 'all'
              ? exams.length
              : tabCounts[tab.key as keyof typeof tabCounts] ?? 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {tab.label}
              <span
                className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  isActive
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 animate-fade-in">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="text-sm font-medium text-[var(--color-text-muted)]">
              Loading exams…
            </p>
          </div>
        </div>
      ) : isError ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              Không tải được danh sách
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
            </p>
          </div>
        </Card>
      ) : exams.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand-soft text-[var(--color-primary)]">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-base font-bold text-[var(--color-text-primary)]">
              Không tìm thấy bài thi
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {activeTab === 'all'
                ? 'Bạn chưa được giao bài thi nào. Quay lại sau nhé!'
                : `Không có bài ${activeTab.replace('_', ' ')} nào.`}
            </p>
          </div>
        </Card>
      ) : activeTab === 'all' && grouped ? (
        <div className="space-y-8">
          {grouped.in_progress.length > 0 && (
            <ExamSection
              dot="bg-amber-500"
              title="Đang làm"
              count={grouped.in_progress.length}
              exams={grouped.in_progress}
            />
          )}
          {grouped.upcoming.length > 0 && (
            <ExamSection
              dot="bg-sky-500"
              title="Sắp diễn ra"
              count={grouped.upcoming.length}
              exams={grouped.upcoming}
            />
          )}
          {grouped.completed.length > 0 && (
            <ExamSection
              dot="bg-emerald-500"
              title="Đã hoàn thành"
              count={grouped.completed.length}
              exams={grouped.completed}
            />
          )}
        </div>
      ) : (
        <div className="grid gap-4 stagger sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <ExamCard key={exam.id} exam={exam} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExamSection({
  dot,
  title,
  count,
  exams,
}: {
  dot: string;
  title: string;
  count: number;
  exams: StudentExamItem[];
}) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold tracking-tight text-[var(--color-text-primary)]">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot} shadow-[0_0_8px_currentColor]`} />
        {title}
        <span className="rounded-full bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--color-text-muted)]">
          {count}
        </span>
      </h2>
      <div className="grid gap-4 stagger sm:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => (
          <ExamCard key={exam.id} exam={exam} />
        ))}
      </div>
    </section>
  );
}
