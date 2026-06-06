import { useEffect, useState } from 'react';

export function PwaUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        if (cancelled) return;

        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(worker);
            }
          });
        });
      } catch {
        // The app still works without service worker support.
      }
    };

    const handleControllerChange = () => {
      window.location.reload();
    };

    void register();
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  if (waitingWorker === null) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-xl)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M21.015 4.356v4.992m0 0h-4.992m4.992 0-3.181-3.183a8.25 8.25 0 0 0-13.803 3.7" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--color-text-primary)]">New version available</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
            Refresh to load the latest WebQuiz release.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => waitingWorker.postMessage({ type: 'SKIP_WAITING' })}
              className="h-10 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] focus-ring-brand"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setWaitingWorker(null)}
              className="h-10 rounded-lg border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] focus-ring-brand"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
