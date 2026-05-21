import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/Table';
import {
  listTeacherExams,
  deleteExam,
  publishExam,
  scheduleExam,
  assignExam,
  getExamAssignments,
} from '@/services/exam.api';
import { listClasses } from '@/services/class.api';
import type {
  TeacherExam,
  TeacherExamStatus,
  ExamAssignmentItem,
  ClassItem,
} from '@/types/exam';
import type { PaginatedResponse } from '@/types/api';
import { useDebounce } from '@/hooks/useDebounce';

const STATUS_CONFIG: Record<TeacherExamStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  CLOSED: { label: 'Closed', variant: 'warning' },
};

const PAGE_SIZE = 10;

export default function ExamsPage() {
  const navigate = useNavigate();

  const [data, setData] = useState<PaginatedResponse<TeacherExam> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);

  const [scheduleModal, setScheduleModal] = useState<TeacherExam | null>(null);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const [assignModal, setAssignModal] = useState<TeacherExam | null>(null);
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<ExamAssignmentItem[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        pageSize: PAGE_SIZE,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      };
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await listTeacherExams(params as never);
      setData(res);
    } catch {
      toast.error('Failed to load exams.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const handleDelete = async (exam: TeacherExam) => {
    if (!window.confirm(`Delete "${exam.title}"? This cannot be undone.`)) return;
    setDeletingId(exam.id);
    try {
      await deleteExam(exam.id);
      toast.success('Exam deleted.');
      fetchExams();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          'Failed to delete exam.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handlePublish = async (exam: TeacherExam) => {
    setPublishingId(exam.id);
    try {
      await publishExam(exam.id);
      toast.success('Exam published!');
      fetchExams();
    } catch {
      toast.error('Failed to publish exam.');
    } finally {
      setPublishingId(null);
    }
  };

  const openScheduleModal = (exam: TeacherExam) => {
    setScheduleModal(exam);
    setScheduleStart('');
    setScheduleEnd('');
  };

  const handleSchedule = async () => {
    if (!scheduleModal || !scheduleStart || !scheduleEnd) return;
    setScheduling(true);
    try {
      await scheduleExam(scheduleModal.id, {
        startTime: new Date(scheduleStart).toISOString(),
        endTime: new Date(scheduleEnd).toISOString(),
      });
      toast.success('Exam scheduled!');
      setScheduleModal(null);
      fetchExams();
    } catch {
      toast.error('Failed to schedule exam.');
    } finally {
      setScheduling(false);
    }
  };

  const openAssignModal = async (exam: TeacherExam) => {
    setAssignModal(exam);
    setSelectedClassIds([]);
    try {
      const [cls, assignments] = await Promise.all([
        listClasses({ pageSize: 200 }),
        getExamAssignments(exam.id),
      ]);
      setAllClasses(cls.items ?? (cls as unknown as ClassItem[]));
      const existing = Array.isArray(assignments) ? assignments : [];
      setExistingAssignments(existing);
      setSelectedClassIds(existing.map((a) => a.classId));
    } catch {
      setAllClasses([]);
      setExistingAssignments([]);
    }
  };

  const handleAssign = async () => {
    if (!assignModal) return;
    const newIds = selectedClassIds.filter(
      (id) => !existingAssignments.some((a) => a.classId === id),
    );
    if (newIds.length === 0) {
      toast('No new classes selected.');
      setAssignModal(null);
      return;
    }
    setAssigning(true);
    try {
      await assignExam(assignModal.id, { classIds: newIds });
      toast.success(`Assigned to ${newIds.length} new class(es)!`);
      setAssignModal(null);
      fetchExams();
    } catch {
      toast.error('Failed to assign exam.');
    } finally {
      setAssigning(false);
    }
  };

  const exams = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exams</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage your exams, schedules and assignments</p>
        </div>
        <Button variant="primary" size="md" onClick={() => navigate('/teacher/exams/create')}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Exam
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Search exams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === '' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {(Object.keys(STATUS_CONFIG) as TeacherExamStatus[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {STATUS_CONFIG[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Loading exams" />
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20">
          <svg className="mb-4 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-base font-semibold text-slate-700">No exams found</p>
          <p className="mt-1 text-sm text-slate-500">
            {statusFilter || search.trim() ? 'Try adjusting your filters.' : 'Create your first exam to get started.'}
          </p>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Title</TableHeaderCell>
              <TableHeaderCell>Subject</TableHeaderCell>
              <TableHeaderCell>Classes</TableHeaderCell>
              <TableHeaderCell className="text-center">Questions</TableHeaderCell>
              <TableHeaderCell className="text-center">Duration</TableHeaderCell>
              <TableHeaderCell className="text-center">Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exams.map((exam) => {
              const sc = STATUS_CONFIG[exam.status] ?? STATUS_CONFIG.DRAFT;
              const isDraft = exam.status === 'DRAFT';
              return (
                <TableRow key={exam.id}>
                  <TableCell className="max-w-[240px]">
                    <p className="truncate font-medium text-slate-800">{exam.title}</p>
                  </TableCell>
                  <TableCell>{exam.subject?.name ?? '—'}</TableCell>
                  <TableCell className="max-w-[200px]">
                    {exam.examAssignments && exam.examAssignments.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {exam.examAssignments.slice(0, 3).map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                            title={a.class?.name}
                          >
                            {a.class?.name ?? `#${a.classId}`}
                          </span>
                        ))}
                        {exam.examAssignments.length > 3 && (
                          <span className="text-xs text-slate-500">
                            +{exam.examAssignments.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs italic text-slate-400">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{exam.totalQuestions}</TableCell>
                  <TableCell className="text-center">{exam.durationMin} min</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(exam.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {isDraft && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/teacher/exams/create?edit=${exam.id}`)}
                        >
                          Edit
                        </Button>
                      )}
                      {(isDraft || exam.status === 'PUBLISHED') && (
                        <Button variant="outline" size="sm" onClick={() => openScheduleModal(exam)}>
                          Schedule
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openAssignModal(exam)}>
                        Assign
                      </Button>
                      {isDraft && (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={publishingId === exam.id}
                          onClick={() => handlePublish(exam)}
                        >
                          Publish
                        </Button>
                      )}
                      {isDraft && (
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={deletingId === exam.id}
                          onClick={() => handleDelete(exam)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>{' '}({total} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      <Modal
        isOpen={scheduleModal !== null}
        onClose={() => setScheduleModal(null)}
        title={`Schedule: ${scheduleModal?.title ?? ''}`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Set the time window when this exam is available for students.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Start Date & Time</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={scheduleStart}
                onChange={(e) => setScheduleStart(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">End Date & Time</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={scheduleEnd}
                min={scheduleStart}
                onChange={(e) => setScheduleEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setScheduleModal(null)}>Cancel</Button>
            <Button
              variant="primary"
              isLoading={scheduling}
              disabled={!scheduleStart || !scheduleEnd || scheduleStart >= scheduleEnd}
              onClick={handleSchedule}
            >
              Save Schedule
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={assignModal !== null}
        onClose={() => setAssignModal(null)}
        title={`Assign: ${assignModal?.title ?? ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Select classes to assign this exam to.
          </p>
          {allClasses.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No classes available.</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              {allClasses.map((cls) => {
                const checked = selectedClassIds.includes(cls.id);
                const alreadyAssigned = existingAssignments.some((a) => a.classId === cls.id);
                return (
                  <button
                    key={cls.id}
                    type="button"
                    disabled={alreadyAssigned}
                    onClick={() => {
                      setSelectedClassIds((prev) =>
                        checked ? prev.filter((id) => id !== cls.id) : [...prev, cls.id],
                      );
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      alreadyAssigned
                        ? 'cursor-default border-emerald-200 bg-emerald-50'
                        : checked
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                        alreadyAssigned
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : checked
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 bg-white'
                      }`}
                    >
                      {(checked || alreadyAssigned) && (
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">
                        {cls.name}
                        {alreadyAssigned && <span className="ml-2 text-xs text-emerald-600">(already assigned)</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        Grade {cls.gradeLevel}
                        {cls.subject ? ` · ${cls.subject.name}` : ''}
                        {cls._count?.classStudents != null ? ` · ${cls._count.classStudents} students` : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAssignModal(null)}>Cancel</Button>
            <Button variant="primary" isLoading={assigning} onClick={handleAssign}>
              Assign ({selectedClassIds.filter((id) => !existingAssignments.some((a) => a.classId === id)).length} new)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
