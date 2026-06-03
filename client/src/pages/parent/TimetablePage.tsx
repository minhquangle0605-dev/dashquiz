import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { TimetableWorkspace, type TimetableClassOption } from '@/components/timetable/TimetableWorkspace';
import { getChildren } from '@/services/parent.api';

export default function TimetablePage() {
  const [classes, setClasses] = useState<TimetableClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const children = await getChildren();
        // Flatten and de-duplicate the classes across the linked child(ren).
        const seen = new Map<number, TimetableClassOption>();
        for (const child of children ?? []) {
          for (const c of child.student.classes ?? []) {
            if (!seen.has(c.id)) {
              seen.set(c.id, { id: c.id, name: c.name, gradeLevel: c.gradeLevel });
            }
          }
        }
        setClasses([...seen.values()]);
      } catch {
        toast.error('Failed to load classes.');
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
          Your child's weekly class timetable.
        </p>
      </div>
      <TimetableWorkspace
        classes={classes}
        classesLoading={loading}
        canManage={false}
        emptyMessage="No classes found for your child yet."
      />
    </div>
  );
}
