import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { TimetableWorkspace, type TimetableClassOption } from '@/components/timetable/TimetableWorkspace';
import { listMyClasses } from '@/services/class.api';

export default function TimetablePage() {
  const [classes, setClasses] = useState<TimetableClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const items = await listMyClasses();
        setClasses(
          (items ?? []).map((c) => ({ id: c.id, name: c.name, gradeLevel: c.gradeLevel })),
        );
      } catch {
        toast.error('Failed to load your classes.');
        setClasses([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">Timetable</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          Your weekly class timetable.
        </p>
      </div>
      <TimetableWorkspace
        classes={classes}
        classesLoading={loading}
        canManage={false}
        emptyMessage="You are not enrolled in any classes yet."
      />
    </div>
  );
}
