import { useEffect } from 'react';

import { useUiStore } from '@/stores/uiStore';

/**
 * Keeps `document.documentElement` in sync with persisted UI theme (adds/removes `.dark`).
 */
export function useThemeEffect() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
}
