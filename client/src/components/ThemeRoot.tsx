import type { ReactNode } from 'react';

import { useThemeEffect } from '@/hooks/useThemeEffect';

import { ThemeToggle } from './ThemeToggle';

export function ThemeRoot({ children }: { children: ReactNode }) {
  useThemeEffect();

  return (
    <>
      {children}
      <ThemeToggle />
    </>
  );
}
