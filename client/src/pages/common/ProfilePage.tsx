import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/Table';
import { useAuth } from '@/hooks/useAuth';
import { getMyGradebook, listMyClasses } from '@/services/class.api';
import type {
  ClassItem,
  GradebookEntry,
  GradeComponentType,
  MyGradebook,
} from '@/types/exam';
import { ROLES } from '@/utils/constants';

type EnrolledClass = ClassItem & { enrolledAt?: string };

type StudentGradebookItem = MyGradebook & {
  sourceClass: EnrolledClass;
};

const gradeComponents: Array<{ type: GradeComponentType; label: string }> = [
  { type: 'REGULAR', label: 'Regular' },
  { type: 'MIDTERM', label: 'Midterm' },
  { type: 'FINAL', label: 'Final' },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const isStudent = user?.role === ROLES.STUDENT;
  const displayName = user?.fullName || user?.username || 'User';
  const [gradebooks, setGradebooks] = useState<StudentGradebookItem[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesError, setGradesError] = useState<string | null>(null);

  const loadStudentGrades = useCallback(async () => {
    if (!isStudent) return;

    setGradesLoading(true);
    setGradesError(null);
    try {
      const classes = await listMyClasses();
      const enrolledClasses = Array.isArray(classes)
        ? (classes as EnrolledClass[])
        : [];
      const results = await Promise.allSettled(
        enrolledClasses.map(async (classItem) => ({
          sourceClass: classItem,
          ...(await getMyGradebook(classItem.id)),
        })),
      );

      const loaded = results
        .filter(
          (result): result is PromiseFulfilledResult<StudentGradebookItem> =>
            result.status === 'fulfilled',
        )
        .map((result) => result.value);

      setGradebooks(loaded);
      if (loaded.length < enrolledClasses.length) {
        toast.error('Some class grades could not be loaded.');
      }
    } catch {
      setGradesError('Failed to load your grades.');
      toast.error('Failed to load your grades.');
    } finally {
      setGradesLoading(false);
    }
  }, [isStudent]);

  useEffect(() => {
    loadStudentGrades();
  }, [loadStudentGrades]);

  const gradeSummary = useMemo(() => {
    const semesterScores = gradebooks
      .map((item) => item.student?.averages.semester)
      .filter(isNumber);
    const entryCount = gradebooks.reduce(
      (total, item) => total + (item.student?.entries.length ?? 0),
      0,
    );
    const average =
      semesterScores.length > 0
        ? semesterScores.reduce((total, score) => total + score, 0) /
          semesterScores.length
        : null;

    return {
      classes: gradebooks.length,
      entries: entryCount,
      average,
    };
  }, [gradebooks]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card padding="lg">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-200 to-slate-400 text-2xl font-bold text-white shadow-inner">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div className="w-full min-w-0 text-center sm:text-left">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  Profile
                </h1>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Account information and learning progress.
                </p>
              </div>
              {user?.role ? (
                <Badge variant="brand" className="self-center capitalize sm:self-auto">
                  {user.role}
                </Badge>
              ) : null}
            </div>

            <dl className="mt-6 grid gap-3 text-left text-sm sm:grid-cols-2">
              <InfoBox label="Full Name" value={user?.fullName || '--'} />
              <InfoBox label="Username" value={user?.username || '--'} />
            </dl>
          </div>
        </div>
      </Card>

      {isStudent ? (
        <Card
          title="My grades"
          subtitle="Component scores from your enrolled classes"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={loadStudentGrades}
              isLoading={gradesLoading}
            >
              Refresh
            </Button>
          }
          padding="md"
        >
          {gradesLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" label="Loading your grades" />
            </div>
          ) : gradesError ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-6 text-center">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {gradesError}
              </p>
              <Button className="mt-4" variant="primary" onClick={loadStudentGrades}>
                Try again
              </Button>
            </div>
          ) : gradebooks.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-[var(--color-border)] py-10 text-center text-sm text-[var(--color-text-muted)]">
              You do not have class grades yet.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryTile label="Classes" value={gradeSummary.classes} />
                <SummaryTile label="Grade entries" value={gradeSummary.entries} />
                <SummaryTile
                  label="Average"
                  value={
                    gradeSummary.average === null
                      ? '--'
                      : formatScore(gradeSummary.average)
                  }
                />
              </div>

              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell className="min-w-[180px]">
                      Class
                    </TableHeaderCell>
                    {gradeComponents.map((component) => (
                      <TableHeaderCell
                        key={component.type}
                        className="min-w-[170px]"
                      >
                        {component.label}
                      </TableHeaderCell>
                    ))}
                    <TableHeaderCell className="min-w-[150px]">
                      Average
                    </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gradebooks.map((gradebook) => (
                    <GradeRow
                      key={gradebook.class.id}
                      gradebook={gradebook}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function GradeRow({ gradebook }: { gradebook: StudentGradebookItem }) {
  const studentRow = gradebook.student;
  const entries = studentRow?.entries ?? [];
  const averages = studentRow?.averages ?? null;

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--color-text-primary)]">
            {gradebook.class.name}
          </p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">
            {[
              gradebook.class.subject?.name,
              gradebook.class.semester?.name,
              gradebook.class.semester?.academicYear?.name,
            ]
              .filter(Boolean)
              .join(' - ')}
          </p>
        </div>
      </TableCell>
      {gradeComponents.map((component) => (
        <TableCell key={component.type}>
          <ScoresCell entries={entries} type={component.type} />
        </TableCell>
      ))}
      <TableCell>
        <div className="space-y-1">
          <Badge variant={scoreVariant(averages?.semester ?? null)}>
            Semester {formatNullableScore(averages?.semester ?? null)}
          </Badge>
          {gradebook.yearAverage !== null ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              Year avg: {formatScore(gradebook.yearAverage)}
            </p>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function ScoresCell({
  entries,
  type,
}: {
  entries: GradebookEntry[];
  type: GradeComponentType;
}) {
  const scores = entries.filter((entry) => entry.componentType === type);
  if (scores.length === 0) {
    return <span className="text-sm text-[var(--color-text-muted)]">No score</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {scores.map((entry) => (
        <span
          key={entry.id}
          title={entry.label || entry.examTitle || entry.activityTitle || 'Grade entry'}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 py-1 text-xs font-semibold text-[var(--color-text-primary)]"
        >
          {formatScore(entry.score)}
          <span className="text-[10px] uppercase text-[var(--color-text-muted)]">
            {entry.source.toLowerCase()}
          </span>
        </span>
      ))}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-bg-subtle)] px-3 py-2">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="font-medium text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
}

function formatNullableScore(score: number | null) {
  return score === null ? '--' : formatScore(score);
}

function formatScore(score: number) {
  if (!Number.isFinite(score)) return '--';
  return score
    .toFixed(2)
    .replace(/\.?0+$/, '');
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function scoreVariant(
  score: number | null,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (score === null) return 'neutral';
  if (score >= 8) return 'success';
  if (score >= 5) return 'warning';
  return 'danger';
}
