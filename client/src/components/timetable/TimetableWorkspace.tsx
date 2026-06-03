import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ClassTimetableGrid } from './ClassTimetableGrid';
import { SlotFormModal } from './SlotFormModal';
import { TimetableImportModal } from './TimetableImportModal';
import {
  cancelSlot,
  clearTimetable,
  createSlot,
  getClassTimetable,
  importTimetable,
  updateSlot,
} from '@/services/timetable.api';
import type { ClassTimetable, CreateSlotPayload, TimetableSlot } from '@/types/timetable';

export interface TimetableClassOption {
  id: number;
  name: string;
  gradeLevel: number;
}

interface TimetableWorkspaceProps {
  classes: TimetableClassOption[];
  classesLoading: boolean;
  canManage: boolean;
  /** Optional message when the user has no classes to show. */
  emptyMessage?: string;
}

export function TimetableWorkspace({
  classes,
  classesLoading,
  canManage,
  emptyMessage = 'No classes available.',
}: TimetableWorkspaceProps) {
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [timetable, setTimetable] = useState<ClassTimetable | null>(null);
  const [loading, setLoading] = useState(false);

  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [prefill, setPrefill] = useState<{ dayOfWeek: number; periodIndex: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const [clearing, setClearing] = useState(false);

  // Default to the first class once the list arrives.
  useEffect(() => {
    if (selectedClassId === null && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const fetchTimetable = useCallback(async (classId: number) => {
    setLoading(true);
    try {
      const data = await getClassTimetable(classId);
      setTimetable(data);
    } catch {
      toast.error('Failed to load timetable.');
      setTimetable(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId !== null) {
      fetchTimetable(selectedClassId);
    }
  }, [selectedClassId, fetchTimetable]);

  const openCreate = (dayOfWeek: number, periodIndex: number) => {
    setEditingSlot(null);
    setPrefill({ dayOfWeek, periodIndex });
    setSlotModalOpen(true);
  };

  const openEdit = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setPrefill(null);
    setSlotModalOpen(true);
  };

  const handleSubmitSlot = async (payload: CreateSlotPayload) => {
    if (selectedClassId === null) return;
    setSaving(true);
    try {
      if (editingSlot) {
        await updateSlot(selectedClassId, editingSlot.id, payload);
        toast.success('Slot updated.');
      } else {
        await createSlot(selectedClassId, payload);
        toast.success('Slot added.');
      }
      setSlotModalOpen(false);
      await fetchTimetable(selectedClassId);
    } catch {
      toast.error('Failed to save slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSlot = async (slot: TimetableSlot) => {
    if (selectedClassId === null) return;
    if (!window.confirm(`Remove "${slot.displayName}" from the timetable?`)) return;
    try {
      await cancelSlot(selectedClassId, slot.id);
      toast.success('Slot removed.');
      await fetchTimetable(selectedClassId);
    } catch {
      toast.error('Failed to remove slot.');
    }
  };

  const handleImport = async () => {
    if (selectedClassId === null || !importFile) return;
    setImporting(true);
    try {
      const result = await importTimetable(selectedClassId, importFile);
      toast.success(`Imported ${result.imported} new, updated ${result.updated}.`);
      if (result.failed > 0) {
        toast(`${result.failed} row(s) skipped — check the file format.`);
      }
      setImportOpen(false);
      setImportFile(null);
      await fetchTimetable(selectedClassId);
    } catch {
      toast.error('Failed to import timetable.');
    } finally {
      setImporting(false);
    }
  };

  const handleClearTimetable = async () => {
    if (selectedClassId === null) return;
    if (
      !window.confirm(
        'Delete the entire timetable for this class? All slots will be permanently removed.',
      )
    )
      return;
    setClearing(true);
    try {
      const result = await clearTimetable(selectedClassId);
      toast.success(`Timetable cleared (${result.deleted} slot(s) removed).`);
      await fetchTimetable(selectedClassId);
    } catch {
      toast.error('Failed to clear timetable.');
    } finally {
      setClearing(false);
    }
  };

  if (classesLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" label="Loading classes" />
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[var(--color-border)] py-14 text-center text-sm text-[var(--color-text-muted)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs">
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">Class</label>
          <select
            value={selectedClassId ?? ''}
            onChange={(e) => setSelectedClassId(Number(e.target.value))}
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Grade {c.gradeLevel})
              </option>
            ))}
          </select>
        </div>

        {canManage && (
          <div className="flex gap-2">
            {timetable && timetable.slots.length > 0 && (
              <Button
                variant="danger"
                size="md"
                onClick={handleClearTimetable}
                isLoading={clearing}
                leftIcon={
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                }
              >
                Clear Timetable
              </Button>
            )}
            <Button variant="outline" size="md" onClick={() => setImportOpen(true)}>
              Import Excel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => openCreate(1, 1)}
              leftIcon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Add Slot
            </Button>
          </div>
        )}
      </div>

      {canManage && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Managed subjects (Mathematics, Physics, Chemistry) are highlighted and used to block
          conflicting exam schedules. All other entries are display-only.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" label="Loading timetable" />
        </div>
      ) : timetable ? (
        <ClassTimetableGrid
          slots={timetable.slots}
          canManage={canManage}
          onAddSlot={openCreate}
          onEditSlot={openEdit}
          onCancelSlot={handleCancelSlot}
        />
      ) : null}

      {canManage && (
        <>
          <SlotFormModal
            isOpen={slotModalOpen}
            saving={saving}
            slot={editingSlot}
            prefill={prefill}
            onSubmit={handleSubmitSlot}
            onClose={() => setSlotModalOpen(false)}
          />
          <TimetableImportModal
            isOpen={importOpen}
            importing={importing}
            file={importFile}
            onFileChange={setImportFile}
            onClose={() => setImportOpen(false)}
            onSubmit={handleImport}
          />
        </>
      )}
    </div>
  );
}
