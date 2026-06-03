import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
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
import { getAccessibleGradebooks } from '@/services/class.api';
import type {
  ClassGradebook,
  GradebookEntry,
  GradebookStudentRow,
  GradeComponentType,
  GradeEntrySource,
} from '@/types/exam';
import { ROLES } from '@/utils/constants';

type GradebookTableRow = {
  classInfo: ClassGradebook['class'];
  student: GradebookStudentRow['student'];
  entries: GradebookEntry[];
  averages: GradebookStudentRow['averages'];
  yearAverage: number | null;
  subjectStatus: GradebookStudentRow['subjectStatus'];
};

const GRADE_COMPONENTS: Array<{
  type: GradeComponentType;
  label: string;
}> = [
  { type: 'REGULAR', label: 'Regular' },
  { type: 'MIDTERM', label: 'Midterm' },
  { type: 'FINAL', label: 'Final' },
];

const sourceLabels: Record<GradeEntrySource, string> = {
  EXAM: 'Exam',
  ACTIVITY: 'Activity',
  MANUAL: 'Manual',
};

// MOET (Circular 22) subject classification tiers, highest to lowest.
const SUBJECT_STATUS_LABELS: Record<'TOT' | 'KHA' | 'DAT' | 'CHUA_DAT', string> = {
  TOT: 'Excellent',
  KHA: 'Good',
  DAT: 'Pass',
  CHUA_DAT: 'Not passed',
};

export default function GradebookPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  const [gradebooks, setGradebooks] = useState<ClassGradebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('all');

  const fetchGradebooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAccessibleGradebooks();
      setGradebooks(result.gradebooks);
    } catch {
      setError('Failed to load gradebooks.');
      toast.error('Failed to load gradebooks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGradebooks();
  }, [fetchGradebooks]);

  const rows = useMemo<GradebookTableRow[]>(() => {
    return gradebooks.flatMap((gradebook) =>
      gradebook.students.map((studentRow) => ({
        classInfo: gradebook.class,
        student: studentRow.student,
        entries: studentRow.entries,
        averages: studentRow.averages,
        yearAverage: studentRow.yearAverage ?? null,
        subjectStatus: studentRow.subjectStatus ?? null,
      })),
    );
  }, [gradebooks]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const classId = selectedClassId === 'all' ? null : Number(selectedClassId);

    return rows.filter((row) => {
      if (classId !== null && row.classInfo.id !== classId) return false;
      if (!query) return true;

      const searchable = [
        row.student.fullName,
        row.student.username,
        row.classInfo.name,
        row.classInfo.subject?.name,
        row.classInfo.subject?.code,
        row.classInfo.semester?.name,
        row.classInfo.semester?.academicYear?.name,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [rows, search, selectedClassId]);

  const summary = useMemo(() => {
    const semesterScores = visibleRows
      .map((row) => row.averages.semester)
      .filter(isNumber);
    const totalEntries = visibleRows.reduce(
      (total, row) => total + row.entries.length,
      0,
    );
    const uniqueStudents = new Set(visibleRows.map((row) => row.student.id)).size;
    const average =
      semesterScores.length > 0
        ? semesterScores.reduce((total, score) => total + score, 0) /
          semesterScores.length
        : null;

    return {
      classes: new Set(visibleRows.map((row) => row.classInfo.id)).size,
      students: uniqueStudents,
      entries: totalEntries,
      average,
    };
  }, [visibleRows]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
            Gradebook
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {isAdmin
              ? 'View component scores for every student across all classes.'
              : 'View component scores for students in your classes.'}
          </p>
        </div>
        <Button variant="outline" onClick={fetchGradebooks} isLoading={loading}>
          Refresh
        </Button>
      </div>

      <Card padding="md">
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Search
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student, username, class, or subject"
              className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Class
            </span>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
            >
              <option value="all">All classes</option>
              {gradebooks.map((gradebook) => (
                <option key={gradebook.class.id} value={gradebook.class.id}>
                  {gradebook.class.name}
                  {gradebook.class.subject ? ` - ${gradebook.class.subject.name}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Loading gradebooks" />
        </div>
      ) : error ? (
        <Card padding="lg">
          <EmptyState
            title="Gradebooks could not be loaded"
            description={error}
            action={
              <Button variant="primary" onClick={fetchGradebooks}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : gradebooks.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="No gradebooks found"
            description={
              isAdmin
                ? 'There are no classes with gradebook data yet.'
                : 'You do not have any class gradebooks yet.'
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Classes" value={summary.classes} />
            <SummaryCard label="Students" value={summary.students} />
            <SummaryCard label="Grade entries" value={summary.entries} />
            <SummaryCard
              label="Avg semester score"
              value={summary.average === null ? '--' : formatScore(summary.average)}
            />
          </div>

          {visibleRows.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                title="No matching students"
                description="Adjust the search or class filter to see grade entries."
              />
            </Card>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="min-w-[220px]">Student</TableHeaderCell>
                  <TableHeaderCell className="min-w-[200px]">Class</TableHeaderCell>
                  {GRADE_COMPONENTS.map((component) => (
                    <TableHeaderCell
                      key={component.type}
                      className="min-w-[180px]"
                    >
                      {component.label}
                    </TableHeaderCell>
                  ))}
                  <TableHeaderCell className="min-w-[150px]">
                    Averages
                  </TableHeaderCell>
                  <TableHeaderCell className="min-w-[110px]">
                    Entries
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={`${row.classInfo.id}-${row.student.id}`}>
                    <TableCell>
                      <StudentIdentity student={row.student} />
                    </TableCell>
                    <TableCell>
                      <ClassIdentity classInfo={row.classInfo} />
                    </TableCell>
                    {GRADE_COMPONENTS.map((component) => (
                      <TableCell key={component.type}>
                        <ScoresCell entries={row.entries} type={component.type} />
                      </TableCell>
                    ))}
                    <TableCell>
                      <AverageSummary row={row} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{row.entries.length}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card padding="md">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
        {value}
      </p>
    </Card>
  );
}

function StudentIdentity({ student }: { student: GradebookTableRow['student'] }) {
  const displayName = student.fullName || student.username;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary-soft)] text-sm font-bold text-[var(--color-primary)]">
        {student.avatar ? (
          <img
            src={student.avatar}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          getInitials(displayName)
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-[var(--color-text-primary)]">
          {displayName}
        </p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">
          @{student.username}
        </p>
      </div>
    </div>
  );
}

function ClassIdentity({ classInfo }: { classInfo: GradebookTableRow['classInfo'] }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-[var(--color-text-primary)]">
        {classInfo.name}
      </p>
      <p className="truncate text-xs text-[var(--color-text-muted)]">
        {[
          classInfo.subject?.name,
          classInfo.semester?.name,
          classInfo.semester?.academicYear?.name,
        ]
          .filter(Boolean)
          .join(' - ')}
      </p>
    </div>
  );
}

function ScoresCell({
  entries,
  type,
}: {
  entries: GradebookEntry[];
  type: GradeComponentType;
}) {
  const componentEntries = entries.filter((entry) => entry.componentType === type);
  if (componentEntries.length === 0) {
    return <span className="text-sm text-[var(--color-text-muted)]">No score</span>;
  }

  return (
    <div className="flex min-w-[170px] flex-wrap gap-1.5">
      {componentEntries.map((entry) => (
        <span
          key={entry.id}
          title={getEntryTitle(entry)}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 py-1 text-xs font-semibold text-[var(--color-text-primary)]"
        >
          <span>{formatScore(entry.score)}</span>
          <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
            {sourceLabels[entry.source]}
          </span>
        </span>
      ))}
    </div>
  );
}

function AverageSummary({ row }: { row: GradebookTableRow }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge variant={scoreVariant(row.averages.semester)}>
          Semester {formatNullableScore(row.averages.semester)}
        </Badge>
        {row.subjectStatus ? (
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">
            {SUBJECT_STATUS_LABELS[row.subjectStatus]}
          </span>
        ) : null}
      </div>
      {row.yearAverage !== null ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          Year avg: {formatScore(row.yearAverage)}
        </p>
      ) : null}
    </div>
  );
}

function getEntryTitle(entry: GradebookEntry) {
  const title = entry.label || entry.examTitle || entry.activityTitle || 'Grade entry';
  return `${title} - ${sourceLabels[entry.source]}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S';
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
