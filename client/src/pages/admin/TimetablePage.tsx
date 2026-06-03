import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { TimetableWorkspace, type TimetableClassOption } from '@/components/timetable/TimetableWorkspace';
import { listClasses } from '@/services/class.api';

export default function TimetablePage() {
  const [classes, setClasses] = useState<TimetableClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClasses = useCallback(async () => {
    try {
      const res = await listClasses({ pageSize: 500 });
      const items = res.items ?? (res as unknown as TimetableClassOption[]);
      setClasses(items.map((c) => ({ id: c.id, name: c.name, gradeLevel: c.gradeLevel })));
    } catch {
      toast.error('Failed to load classes.');
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">Timetable</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          View and manage the weekly timetable for any class.
        </p>
      </div>
      <TimetableWorkspace
        classes={classes}
        classesLoading={loading}
        canManage
        canCreateClass
        emptyMessage="No classes exist yet."
        onClassesChanged={loadClasses}
      />
    </div>
  );
}
