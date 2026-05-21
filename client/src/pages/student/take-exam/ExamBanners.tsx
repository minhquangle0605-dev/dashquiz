import { AnimatePresence, motion } from 'framer-motion';

interface ExamBannersProps {
  showTabWarning: boolean;
  tabSwitchCount: number;
  tabSwitchLimit: number;
  isOnline: boolean;
}

export function ExamBanners({
  showTabWarning,
  tabSwitchCount,
  tabSwitchLimit,
  isOnline,
}: ExamBannersProps) {
  return (
    <AnimatePresence>
      {showTabWarning && (
        <motion.div
          key="tab-warn"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden bg-[var(--color-danger)] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md"
        >
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Tab switch detected ({tabSwitchCount}/{tabSwitchLimit}). This activity is being recorded.
          </span>
        </motion.div>
      )}
      {!isOnline && (
        <motion.div
          key="offline"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden bg-[var(--color-warning)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--color-on-warning)] shadow-md"
        >
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a4 4 0 010-5.303m5.304 0a4 4 0 010 5.303m-7.425 2.122a7 7 0 010-9.546m9.546 0a7 7 0 010 9.546" />
            </svg>
            You are offline. Your answers are saved locally and will sync when you reconnect.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
