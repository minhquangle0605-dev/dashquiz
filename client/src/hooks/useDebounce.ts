import { useEffect, useState } from 'react';

/**
 * Returns `value` only after it has stayed stable for `delayMs` milliseconds.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [value, delayMs]);

  return debounced;
}
