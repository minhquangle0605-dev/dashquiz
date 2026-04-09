import { useEffect, useRef } from 'react';

export type ShortcutHandlerMap = {
  'ctrl+k'?: () => void;
  escape?: () => void;
} & Record<string, (() => void) | undefined>;

function normalizeCombo(combo: string): string {
  return combo.trim().toLowerCase().replace(/\s+/g, '');
}

function handleCombo(event: KeyboardEvent, combo: string, fn: () => void): boolean {
  const c = normalizeCombo(combo);

  if (c === 'escape' || c === 'esc') {
    if (event.key !== 'Escape') return false;
    fn();
    return true;
  }

  if (c === 'ctrl+k') {
    if (event.key.toLowerCase() !== 'k') return false;
    if (!(event.ctrlKey || event.metaKey)) return false;
    if (event.shiftKey || event.altKey) return false;
    event.preventDefault();
    fn();
    return true;
  }

  return false;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandlerMap): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = shortcutsRef.current;
      const entries = Object.entries(current).filter(
        (e): e is [string, () => void] => typeof e[1] === 'function'
      );

      for (const [combo, handler] of entries) {
        if (handleCombo(event, combo, handler)) {
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
