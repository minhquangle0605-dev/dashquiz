import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

const transition = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

export type PageTransitionProps = {
  children: ReactNode;
  /** Stable key per logical page (e.g. `location.pathname`) for AnimatePresence. */
  transitionKey: string;
  className?: string;
};

export function PageTransition({ children, transitionKey, className }: PageTransitionProps) {
  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={transitionKey}
        className={className}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
