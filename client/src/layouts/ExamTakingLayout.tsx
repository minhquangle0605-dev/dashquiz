import { Outlet } from 'react-router-dom';

/**
 * Minimal, chrome-less layout for the in-progress exam runner.
 *
 * Unlike {@link StudentLayout}, this renders no sidebar, header, or bottom
 * navigation — the student sees only the exam interface, which keeps the
 * runner focused and works alongside the enforced fullscreen mode.
 */
export default function ExamTakingLayout() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      <Outlet />
    </div>
  );
}
