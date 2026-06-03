import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { ConflictDialog } from '@/components/timetable/ConflictDialog';
import {
  listTeacherExams,
  deleteExam,
  scheduleExam,
  assignExam,
  getExamAssignments,
} from '@/services/exam.api';
import { listClasses } from '@/services/class.api';
import { checkConflicts } from '@/services/timetable.api';
import type {
  TeacherExam,
  TeacherExamStatus,
  ExamAssignmentItem,
  ClassItem,
} from '@/types/exam';
import type { ConflictCheckResult, ConflictItem } from '@/types/timetable';

const STATUS_CONFIG: Record<TeacherExamStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  CLOSED: { label: 'Closed', variant: 'warning' },
};

function extractConflictError(err: unknown): { message: string; conflicts: ConflictItem[] } {
  const data = (err as { response?: { data?: { message?: string; errors?: unknown } } })?.response
    ?.data;
  const conflicts = Array.isArray(data?.errors) ? (data?.errors as ConflictItem[]) : [];
  return { message: data?.message ?? 'Request failed.', conflicts };
}

export default function AdminExamsPage() {
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [scheduleModal, setScheduleModal] = useState<TeacherExam | null>(null);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleClassId, setScheduleClassId] = useState<number | ''>('');
  const [scheduleRoom, setScheduleRoom] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);

  const [assignModal, setAssignModal] = useState<TeacherExam | null>(null);
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<ExamAssignmentItem[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTeacherExams({ pageSize: 100, search: search || undefined });
      setExams(res.items ?? []);
    } catch {
      toast.error('Failed to load exams.');
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleDelete = async (exam: TeacherExam) => {
    const attemptCount = exam._count?.examAttempts ?? 0;
    // Admins may delete an exam even after students have attempted it — the
    // cascade wipes those attempts and results, so warn explicitly first.
    const warning =
      attemptCount > 0
        ? `\n\n⚠️ This exam has ${attemptCount} student attempt(s). Deleting it will PERMANENTLY remove all attempts, answers and results.`
        : ' Its schedules and class assignments will also be removed.';
    if (!window.confirm(`Delete "${exam.title}"?${warning}\n\nThis cannot be undone.`)) return;
    setDeletingId(exam.id);
    try {
      await deleteExam(exam.id);
      toast.success('Exam deleted.');
      fetchExams();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      toast.error(
        e?.response?.data?.message || e?.response?.data?.error || 'Failed to delete exam.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  const openSchedule = (exam: TeacherExam) => {
    setScheduleModal(exam);
    setScheduleStart('');
    setScheduleEnd('');
    setScheduleClassId('');
    setScheduleRoom('');
  };

  const commitSchedule = async (force: boolean) => {
    if (!scheduleModal || !scheduleStart || !scheduleEnd) return;
    setScheduling(true);
    try {
      await scheduleExam(scheduleModal.id, {
        startTime: new Date(scheduleStart).toISOString(),
        endTime: new Date(scheduleEnd).toISOString(),
        classId: scheduleClassId === '' ? null : scheduleClassId,
        room: scheduleRoom.trim() || null,
        force,
      });
      toast.success('Exam scheduled!');
      setConflictResult(null);
      setScheduleModal(null);
      fetchExams();
    } catch (err) {
      const { message } = extractConflictError(err);
      toast.error(message || 'Failed to schedule exam.');
    } finally {
      setScheduling(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleModal || !scheduleStart || !scheduleEnd) return;
    const allClassIds = (scheduleModal.examAssignments ?? []).map((a) => a.classId);
    const targetClassIds = scheduleClassId === '' ? allClassIds : [scheduleClassId];
    if (targetClassIds.length === 0) {
      await commitSchedule(false);
      return;
    }
    setScheduling(true);
    try {
      const result = await checkConflicts({
        classIds: targetClassIds,
        subjectId: scheduleModal.subjectId,
        startTime: new Date(scheduleStart).toISOString(),
        endTime: new Date(scheduleEnd).toISOString(),
        excludeExamId: scheduleModal.id,
        room: scheduleRoom.trim() || null,
      });
      if (result.hardConflicts.length === 0 && result.softWarnings.length === 0) {
        await commitSchedule(false);
      } else {
        setConflictResult(result);
      }
    } catch {
      toast.error('Failed to check schedule conflicts.');
    } finally {
      setScheduling(false);
    }
  };

  const openAssign = async (exam: TeacherExam) => {
    setAssignModal(exam);
    setSelectedClassIds([]);
    try {
      const [cls, assignments] = await Promise.all([
        listClasses({ pageSize: 500 }),
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
    } catch (err) {
      const { message, conflicts } = extractConflictError(err);
      const detail = conflicts.length > 0 ? `: ${conflicts.map((c) => c.message).join('; ')}` : '';
      toast.error(`${message}${detail}` || 'Failed to assign exam.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">Exams</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            Oversee all exams. As an administrator you can schedule (with conflict override) and assign.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search exams…"
          className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm sm:w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" label="Loading exams" />
        </div>
      ) : exams.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--color-border)] py-14 text-center text-sm text-[var(--color-text-muted)]">
          No exams found.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {exams.map((exam) => {
            const sc = STATUS_CONFIG[exam.status] ?? STATUS_CONFIG.DRAFT;
            const assignmentCount = exam.examAssignments?.length ?? 0;
            const scheduleCount = exam.examSchedules?.length ?? 0;
            return (
              <li
                key={exam.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                        {exam.title}
                      </h3>
                      <Badge variant={sc.variant} size="sm">{sc.label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                      {exam.subject && <span>{exam.subject.name}</span>}
                      <span>{assignmentCount} class(es)</span>
                      <span>{scheduleCount} schedule(s)</span>
                      {exam.creator?.fullName && <span>by {exam.creator.fullName}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => openSchedule(exam)}>
                      Schedule
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openAssign(exam)}>
                      Assign
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      isLoading={deletingId === exam.id}
                      onClick={() => handleDelete(exam)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Schedule modal */}
      <Modal
        isOpen={scheduleModal !== null}
        onClose={() => setScheduleModal(null)}
        title={`Schedule: ${scheduleModal?.title ?? ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">Start</label>
              <input
                type="datetime-local"
                className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm"
                value={scheduleStart}
                onChange={(e) => setScheduleStart(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">End</label>
              <input
                type="datetime-local"
                className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm"
                value={scheduleEnd}
                min={scheduleStart}
                onChange={(e) => setScheduleEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">Apply to class</label>
              <select
                className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm"
                value={scheduleClassId}
                onChange={(e) => setScheduleClassId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">All assigned classes</option>
                {(scheduleModal?.examAssignments ?? []).map((a) => (
                  <option key={a.classId} value={a.classId}>
                    {a.class?.name ?? `Class #${a.classId}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">Room (optional)</label>
              <input
                type="text"
                maxLength={50}
                placeholder="e.g. A101"
                className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm"
                value={scheduleRoom}
                onChange={(e) => setScheduleRoom(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
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

      {/* Assign modal */}
      <Modal
        isOpen={assignModal !== null}
        onClose={() => setAssignModal(null)}
        title={`Assign: ${assignModal?.title ?? ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {allClasses.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">No classes available.</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
              {allClasses.map((cls) => {
                const checked = selectedClassIds.includes(cls.id);
                const alreadyAssigned = existingAssignments.some((a) => a.classId === cls.id);
                return (
                  <button
                    key={cls.id}
                    type="button"
                    disabled={alreadyAssigned}
                    onClick={() =>
                      setSelectedClassIds((prev) =>
                        checked ? prev.filter((id) => id !== cls.id) : [...prev, cls.id],
                      )
                    }
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm ${
                      alreadyAssigned
                        ? 'cursor-default border-[var(--color-success)]/40 bg-[var(--color-success)]/10'
                        : checked
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                          : 'border-[var(--color-border)] bg-[var(--color-bg-card)]'
                    }`}
                  >
                    <span className="font-medium text-[var(--color-text-primary)]">{cls.name}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Grade {cls.gradeLevel}
                      {alreadyAssigned ? ' · already assigned' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setAssignModal(null)}>Cancel</Button>
            <Button variant="primary" isLoading={assigning} onClick={handleAssign}>
              Assign ({selectedClassIds.filter((id) => !existingAssignments.some((a) => a.classId === id)).length} new)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Admin override dialog */}
      <ConflictDialog
        isOpen={conflictResult !== null}
        hardConflicts={conflictResult?.hardConflicts ?? []}
        softWarnings={conflictResult?.softWarnings ?? []}
        canForce
        forcing={scheduling}
        onConfirm={() => commitSchedule((conflictResult?.hardConflicts.length ?? 0) > 0)}
        onClose={() => setConflictResult(null)}
      />
    </div>
  );
}
