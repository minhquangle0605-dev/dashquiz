interface ExamHeaderProps {
  title: string;
  lastSaved: Date | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'pending' | 'offline' | 'error';
  tabSwitchCount: number;
  timeLeft: number;
  isWarning: boolean;
  isCritical: boolean;
  onToggleSidebar: () => void;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ExamHeader({
  title,
  lastSaved,
  saveStatus,
  tabSwitchCount,
  timeLeft,
  isWarning,
  isCritical,
  onToggleSidebar,
}: ExamHeaderProps) {
  const savedAt = lastSaved?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const saveLabel =
    saveStatus === 'saving'
      ? 'Saving...'
      : saveStatus === 'pending'
        ? 'Unsynced changes'
        : saveStatus === 'offline'
          ? 'Offline draft'
          : saveStatus === 'error'
            ? 'Save retrying'
            : savedAt
              ? `Saved ${savedAt}`
              : 'Autosave ready';
  const saveTone =
    saveStatus === 'offline' || saveStatus === 'error'
      ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
      : saveStatus === 'pending' || saveStatus === 'saving'
        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
        : 'bg-[var(--color-success-soft)] text-[var(--color-success)]';

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-4 py-3 shadow-[var(--shadow-sm)] sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-[var(--shadow-brand)]">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-base">
            {title}
          </h1>
          <span
            className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${saveTone}`}
            aria-live="polite"
          >
            {saveStatus === 'saving' ? (
              <span
                className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
            ) : (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={
                    saveStatus === 'offline' || saveStatus === 'error'
                      ? 'M12 9v3.75m0 3.75h.008v.008H12v-.008zM10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'
                      : 'M4.5 12.75l6 6 9-13.5'
                  }
                />
              </svg>
            )}
            <span className="truncate">{saveLabel}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {tabSwitchCount > 0 && (
          <div className="hidden items-center gap-1.5 rounded-lg bg-[var(--color-danger-soft)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--color-danger)] sm:inline-flex">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {tabSwitchCount}
          </div>
        )}

        <div
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold tabular-nums shadow-[var(--shadow-sm)] transition-colors ${
            isCritical
              ? 'bg-[var(--color-danger)] text-white animate-pulse-ring'
              : isWarning
                ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] ring-1 ring-inset ring-[var(--color-warning)]/30'
                : 'bg-[var(--color-bg-muted)] text-[var(--color-text-primary)]'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatTime(timeLeft)}
        </div>

        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-muted)] focus-ring-brand lg:hidden"
          aria-label="Toggle question navigator"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
