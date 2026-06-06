import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISSED_AT_KEY = 'webquiz-pwa-install-dismissed-at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean(navigator.standalone))
  );
}

function wasDismissedRecently() {
  const dismissedAt = Number(localStorage.getItem(DISMISSED_AT_KEY) ?? '0');
  return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_DURATION_MS;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  if (!visible || installEvent === null) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setVisible(false);
    setInstallEvent(null);
  };

  const install = async () => {
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'dismissed') {
        localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
      }
    } finally {
      setVisible(false);
      setInstallEvent(null);
    }
  };

  return (
    <div className="fixed inset-x-4 bottom-20 z-40 mx-auto max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-xl)] lg:bottom-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l4-4m-4 4l-4-4M4.5 19.5h15" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--color-text-primary)]">Install WebQuiz</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
            Add WebQuiz to this device for a standalone app experience.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void install()}
              className="h-10 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] focus-ring-brand"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismiss}
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
