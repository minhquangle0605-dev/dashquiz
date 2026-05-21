import { useCallback, useEffect, useRef, useState } from 'react';

import { Spinner } from '@/components/ui/Spinner';
import type { ClassItem, ClassStudent } from '@/types/exam';

interface StudentRosterListProps {
  selectedClass: ClassItem;
  students: ClassStudent[];
  loading: boolean;
}

const SCROLL_STEP = 220;

export function StudentRosterList({ selectedClass, students, loading }: StudentRosterListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    recompute();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', recompute, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', recompute);
      ro.disconnect();
    };
  }, [recompute, students.length]);

  const scrollBy = (dy: number) => {
    scrollRef.current?.scrollBy({ top: dy, behavior: 'smooth' });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)]">
      <div className="border-b border-[var(--color-border-subtle)] bg-gradient-brand-soft px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-bold tracking-tight text-[var(--color-text-primary)]">
                {selectedClass.name}
              </h2>
              <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--color-primary)]">
                {students.length}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">Thành viên lớp</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => scrollBy(-SCROLL_STEP)}
              disabled={!canScrollUp}
              aria-label="Cuộn lên"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:hover:bg-[var(--color-bg-card)] disabled:hover:text-[var(--color-text-secondary)]"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollBy(SCROLL_STEP)}
              disabled={!canScrollDown}
              aria-label="Cuộn xuống"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:hover:bg-[var(--color-bg-card)] disabled:hover:text-[var(--color-text-secondary)]"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {selectedClass.teacher && (
          <p className="mt-2 truncate text-xs text-[var(--color-text-secondary)]">
            <span className="font-semibold">GV:</span> {selectedClass.teacher.fullName}
          </p>
        )}
      </div>

      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto px-3 py-3 scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="md" label="Loading classmates" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] py-10 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Chưa có thành viên
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Danh sách lớp đang trống.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {students.map((s, idx) => {
              const name = s.student.fullName || s.student.username || '—';
              const initials = (s.student.fullName || s.student.username || '?')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
              return (
                <li
                  key={s.studentId}
                  className="flex items-center gap-3 rounded-xl border border-transparent bg-[var(--color-bg-muted)]/40 px-3 py-2 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-bg-card)]"
                >
                  <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-[var(--color-text-muted)]">
                    {idx + 1}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[11px] font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {name}
                    </p>
                    <p className="truncate font-mono text-[11px] text-[var(--color-text-muted)]">
                      @{s.student.username}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
