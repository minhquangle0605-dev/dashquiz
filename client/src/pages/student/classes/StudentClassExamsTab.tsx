import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { listStudentExams } from '@/services/studentExam.api';
import { startStudentExam } from '@/services/studentExam.api';
import { formatDate } from '@/utils/format';
import type { ClassItem, StudentExamItem } from '@/types/exam';

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

interface StudentClassExamsTabProps {
  selectedClass: ClassItem;
}

export function StudentClassExamsTab({ selectedClass }: StudentClassExamsTabProps) {
  const navigate = useNavigate();
  const [exams, setExams] = useState<StudentExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<number | null>(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listStudentExams({
        classId: selectedClass.id,
        limit: 50,
      });
      setExams(res.data ?? []);
    } catch {
      toast.error('Failed to load exam list.');
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClass.id]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleStart = async (exam: StudentExamItem) => {
    // Password-protected exams are unlocked inside TakeExamPage.
    if (exam.hasPassword) {
      navigate(`/student/exams/${exam.id}/take`);
      return;
    }
    setStartingId(exam.id);
    try {
      await startStudentExam(exam.id);
      navigate(`/student/exams/${exam.id}/take`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start the exam';
      toast.error(msg);
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
          Class Exams
        </h3>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          All exams assigned to class{' '}
          <span className="font-semibold text-[var(--color-text-primary)]">
            {selectedClass.name}
          </span>
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" label="Loading exams" />
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-border)] py-14 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand-soft text-[var(--color-primary)]">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-[var(--color-text-primary)]">
            This class has no exams yet
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            When your teacher assigns exams, they will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {exams.map((exam) => {
            const badge = phaseBadge(exam.phase);
            const schedule = exam.examSchedules?.[0];
            return (
              <li
                key={exam.id}
                className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-primary-soft-strong)] hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                        {exam.title}
                      </h4>
                      <Badge variant={badge.variant} size="sm" dot>{badge.label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {exam.durationMin} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {exam._count.examQuestions} questions
                      </span>
                      {schedule && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(schedule.startTime, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                      {exam.completedCount > 0 && (exam.finalScore ?? exam.bestScore) !== null && (
                        <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-success)]">
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {exam.finalScore ?? exam.bestScore} pts
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {exam.hasInProgress ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/student/exams/${exam.id}/take`)}
                      >
                        Resume
                      </Button>
                    ) : exam.canStart ? (
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={startingId === exam.id}
                        onClick={() => handleStart(exam)}
                      >
                        Start
                      </Button>
                    ) : exam.phase === 'completed' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/student/exams`)}
                      >
                        View Results
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" disabled>
                        Not yet available
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
