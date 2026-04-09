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
      const msg =
        err instanceof Error ? err.message : 'Failed to start exam';
      toast.error(msg);
    }
  };

  const handleResume = () => {
    navigate(`/student/exams/${exam.id}/take`);
  };

  return (
    <Card padding="none" className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex flex-col h-full">
        {/* Color bar */}
        <div
          className={`h-1.5 w-full ${
            exam.phase === 'upcoming'
              ? 'bg-sky-500'
              : exam.phase === 'in_progress'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          }`}
        />

        <div className="flex flex-col flex-1 p-5 gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-slate-900 leading-snug line-clamp-2">
                {exam.title}
              </h3>
              {exam.subject && (
                <p className="mt-1 text-sm text-slate-500">
                  {exam.subject.name}
                </p>
              )}
            </div>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {exam.durationMin} min
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {exam._count.examQuestions} questions
            </div>
            {schedule && (
              <div className="col-span-2 flex items-center gap-2 text-slate-600">
                <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
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
              </div>
            )}
            {exam.phase === 'completed' && exam.bestScore !== null && (
              <div className="col-span-2 flex items-center gap-2 text-slate-600">
                <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                Best: {exam.bestScore} pts
                <span className="text-slate-400">
                  ({exam.completedCount}/{exam.maxAttempts} attempts)
                </span>
              </div>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action */}
          <div className="pt-2 border-t border-slate-100">
            {exam.hasInProgress ? (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={handleResume}
              >
                Resume Exam
              </Button>
            ) : exam.canStart ? (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                isLoading={startMutation.isPending}
                onClick={handleStart}
              >
                Start Exam
              </Button>
            ) : exam.phase === 'completed' ? (
              <Button
                variant="outline"
                size="md"
                className="w-full"
                onClick={() => navigate(`/student/exams/${exam.id}/result`)}
              >
                View Results
              </Button>
            ) : (
              <Button variant="secondary" size="md" className="w-full" disabled>
                Not Available
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
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Exams</h1>
        <p className="mt-1 text-sm text-slate-500">
          View and take exams assigned to your classes
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((tab) => {
          const count =
            tab.key === 'all'
              ? exams.length
              : tabCounts[tab.key as keyof typeof tabCounts] ?? 0;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              <span
                className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  activeTab === tab.key
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-200 text-slate-600'
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
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500">Loading exams...</p>
          </div>
        </div>
      ) : isError ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">
              Failed to load exams
            </p>
            <p className="text-sm text-slate-500">
              {error instanceof Error ? error.message : 'Please try again later'}
            </p>
          </div>
        </Card>
      ) : exams.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-base font-medium text-slate-700">No exams found</p>
            <p className="text-sm text-slate-500">
              {activeTab === 'all'
                ? 'You have no exams assigned yet. Check back later.'
                : `No ${activeTab.replace('_', ' ')} exams right now.`}
            </p>
          </div>
        </Card>
      ) : activeTab === 'all' && grouped ? (
        <div className="space-y-8">
          {grouped.in_progress.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                In Progress
                <span className="text-sm font-normal text-slate-400">
                  ({grouped.in_progress.length})
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.in_progress.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            </section>
          )}

          {grouped.upcoming.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />
                Upcoming
                <span className="text-sm font-normal text-slate-400">
                  ({grouped.upcoming.length})
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.upcoming.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            </section>
          )}

          {grouped.completed.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Completed
                <span className="text-sm font-normal text-slate-400">
                  ({grouped.completed.length})
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.completed.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <ExamCard key={exam.id} exam={exam} />
          ))}
        </div>
      )}
    </div>
  );
}
