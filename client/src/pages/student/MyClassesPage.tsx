import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { listMyClasses } from '@/services/class.api';
import type { ClassItem } from '@/types/exam';

type EnrolledClass = ClassItem & { enrolledAt?: string };

export default function MyClassesPage() {
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMyClasses();
      setClasses(data);
    } catch {
      toast.error('Failed to load your classes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading your classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Classes</h1>
        <p className="mt-1 text-sm text-slate-500">
          All the classes you are currently enrolled in.
        </p>
      </div>

      {classes.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-700">
              You are not enrolled in any class yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Once a teacher adds you to a class, it will appear here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls }: { cls: EnrolledClass }) {
  const enrolledLabel = cls.enrolledAt
    ? new Date(cls.enrolledAt).toLocaleDateString()
    : null;

  return (
    <Card padding="none" className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-indigo-700" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 truncate">
              {cls.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Grade {cls.gradeLevel}
            </p>
          </div>
          {cls.subject && (
            <Badge variant="info">{cls.subject.name}</Badge>
          )}
        </div>

        <div className="space-y-2 text-sm">
          {cls.teacher && (
            <InfoRow
              icon={iconUser}
              label="Teacher"
              value={cls.teacher.fullName}
            />
          )}
          {cls.semester && (
            <InfoRow
              icon={iconCalendar}
              label="Semester"
              value={
                cls.semester.academicYear
                  ? `${cls.semester.name} • ${cls.semester.academicYear.name}`
                  : cls.semester.name
              }
            />
          )}
          {typeof cls._count?.classStudents === 'number' && (
            <InfoRow
              icon={iconGroup}
              label="Students"
              value={`${cls._count.classStudents}`}
            />
          )}
          {enrolledLabel && (
            <InfoRow icon={iconClock} label="Joined" value={enrolledLabel} />
          )}
        </div>
      </div>
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-slate-600">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </span>
      <span className="text-xs font-medium text-slate-500 w-20">{label}</span>
      <span className="text-sm font-medium text-slate-800 truncate">
        {value}
      </span>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────

const iconUser = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const iconCalendar = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const iconGroup = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM7 12a3 3 0 100-6 3 3 0 000 6z" />
  </svg>
);

const iconClock = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
