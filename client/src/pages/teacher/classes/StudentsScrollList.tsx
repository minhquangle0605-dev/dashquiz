import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { ClassItem, ClassStudent } from '@/types/exam';

interface StudentsScrollListProps {
  selectedClass: ClassItem;
  students: ClassStudent[];
  loading: boolean;
  removingId: number | null;
  onOpenImport: () => void;
  onOpenAdd: () => void;
  onRemove: (studentId: number) => void;
}

const SCROLL_STEP = 220;

export function StudentsScrollList({
  selectedClass,
  students,
  loading,
  removingId,
  onOpenImport,
  onOpenAdd,
  onRemove,
}: StudentsScrollListProps) {
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
            <p className="text-xs text-[var(--color-text-muted)]">Học sinh trong lớp</p>
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

        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onOpenImport}>
            Import
          </Button>
          <Button variant="primary" size="sm" className="flex-1" onClick={onOpenAdd}>
            + Thêm
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto px-3 py-3 scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="md" label="Loading students" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Chưa có học sinh</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Nhấn "+ Thêm" hoặc Import để bắt đầu.
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
                  className="group flex items-center gap-3 rounded-xl border border-transparent bg-[var(--color-bg-muted)]/40 px-3 py-2 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-bg-card)]"
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
                  <button
                    type="button"
                    onClick={() => onRemove(s.studentId)}
                    disabled={removingId === s.studentId}
                    aria-label={`Xóa ${name}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] opacity-0 transition-all hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] group-hover:opacity-100 disabled:opacity-60"
                  >
                    {removingId === s.studentId ? (
                      <Spinner size="sm" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
