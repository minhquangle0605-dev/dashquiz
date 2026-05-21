import { Badge } from '@/components/ui/Badge';
import type { ClassItem } from '@/types/exam';

interface ClassGridProps {
  classes: ClassItem[];
  selectedClassId?: number;
  onSelect: (cls: ClassItem) => void;
  onEdit: (cls: ClassItem) => void;
}

const gradientPalette = [
  'from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10',
  'from-cyan-500/10 via-sky-500/10 to-indigo-500/10',
  'from-emerald-500/10 via-teal-500/10 to-cyan-500/10',
  'from-amber-500/10 via-orange-500/10 to-rose-500/10',
  'from-pink-500/10 via-rose-500/10 to-red-500/10',
  'from-purple-500/10 via-indigo-500/10 to-blue-500/10',
];

export function ClassGrid({ classes, selectedClassId, onSelect, onEdit }: ClassGridProps) {
  return (
    <div className="grid gap-4 stagger sm:grid-cols-2 lg:grid-cols-3">
      {classes.map((cls, i) => {
        const isSelected = selectedClassId === cls.id;
        const gradient = gradientPalette[i % gradientPalette.length];
        return (
          <button
            key={cls.id}
            type="button"
            onClick={() => onSelect(cls)}
            className={`group relative overflow-hidden rounded-2xl border bg-[var(--color-bg-card)] p-5 text-left shadow-[var(--shadow-sm)] transition-all duration-200 will-change-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] focus-ring-brand ${
              isSelected
                ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-soft-strong)]'
                : 'border-[var(--color-border)]'
            }`}
          >
            <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} blur-2xl opacity-80`} />
            <div className="relative">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold tracking-tight text-[var(--color-text-primary)]">
                    {cls.name}
                  </h3>
                  {cls.subject && (
                    <p className="mt-0.5 truncate text-xs font-medium text-[var(--color-text-muted)]">
                      {cls.subject.name}
                    </p>
                  )}
                </div>
                <Badge variant="brand" size="sm">
                  K{cls.gradeLevel}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--color-border-subtle)] pt-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    Học sinh
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
                    {cls._count?.classStudents ?? 0}
                  </p>
                </div>
                {cls.semester && (
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                      Năm học
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {cls.semester.academicYear?.name ?? cls.semester.name}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-3 flex justify-end opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(cls);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      onEdit(cls);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-bg-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                  Sửa
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
