import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

const transition = { duration: 0.2 };

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
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
