import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';
import { ROLES, type UserRole } from '@/utils/constants';

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CommandItem = {
  id: string;
  label: string;
  to: string;
  keywords: string;
};

function commandsForRole(role: UserRole | undefined): CommandItem[] {
  switch (role) {
    case ROLES.ADMIN:
      return [
        { id: 'admin-dashboard', label: 'Dashboard', to: '/admin/dashboard', keywords: 'home overview' },
        { id: 'admin-users', label: 'Users', to: '/admin/users', keywords: 'people accounts members' },
        { id: 'admin-academic', label: 'Academic', to: '/admin/academic', keywords: 'subjects curriculum years' },
        { id: 'admin-system', label: 'System', to: '/admin/system', keywords: 'settings monitoring logs backups' },
        { id: 'admin-profile', label: 'Profile', to: '/admin/profile', keywords: 'account me settings' },
      ];
    case ROLES.TEACHER:
      return [
        { id: 'teacher-dashboard', label: 'Dashboard', to: '/teacher/dashboard', keywords: 'home overview' },
        { id: 'teacher-questions', label: 'Question Bank', to: '/teacher/questions', keywords: 'questions bank items' },
        { id: 'teacher-exams', label: 'Exams', to: '/teacher/exams', keywords: 'tests assessments' },
        { id: 'teacher-classes', label: 'Classes', to: '/teacher/classes', keywords: 'courses groups students' },
        { id: 'teacher-profile', label: 'Profile', to: '/teacher/profile', keywords: 'account me settings' },
      ];
    case ROLES.STUDENT:
      return [
        { id: 'student-dashboard', label: 'Dashboard', to: '/student/dashboard', keywords: 'home overview' },
        { id: 'student-graph', label: 'Knowledge Graph', to: '/student/knowledge-graph', keywords: 'graph analytics topics' },
        { id: 'student-exams', label: 'Exams', to: '/student/exams', keywords: 'tests take assignments' },
        { id: 'student-ai', label: 'AI Practice', to: '/student/ai-practice', keywords: 'practice tutor study' },
        { id: 'student-profile', label: 'Profile', to: '/student/profile', keywords: 'account me settings' },
      ];
    case ROLES.PARENT:
      return [
        { id: 'parent-dashboard', label: 'Dashboard', to: '/parent/dashboard', keywords: 'home overview' },
        { id: 'parent-results', label: "Child's Results", to: '/parent/results', keywords: 'results grades scores children' },
        { id: 'parent-link', label: 'Link Student', to: '/parent/link-student', keywords: 'connect child enroll' },
        { id: 'parent-profile', label: 'Profile', to: '/parent/profile', keywords: 'account me settings' },
      ];
    default:
      return [];
  }
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedIndexRef = useRef(0);
  const filteredRef = useRef<CommandItem[]>([]);

  const allItems = useMemo(() => commandsForRole(user?.role), [user?.role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.to.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  filteredRef.current = filtered;
  selectedIndexRef.current = selectedIndex;

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const go = useCallback(
    (to: string) => {
      navigate(to);
      close();
    },
    [navigate, close]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIndex(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => {
          const max = Math.max(0, filteredRef.current.length - 1);
          return Math.min(i + 1, max);
        });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        const item = filteredRef.current[selectedIndexRef.current];
        if (item) {
          e.preventDefault();
          go(item.to);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, go, close]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, selectedIndex]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="command-palette"
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            role="presentation"
            tabIndex={-1}
            aria-hidden
            className="absolute inset-0 cursor-default bg-slate-900/45 backdrop-blur-sm"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 backdrop-blur-xl"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200/90 px-3 py-2">
              <div className="flex items-center gap-2 rounded-xl bg-slate-100/90 px-3 py-2">
                <svg
                  className="h-5 w-5 shrink-0 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages…"
                  className="min-h-11 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <kbd className="hidden shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 sm:inline">
                  Esc
                </kbd>
              </div>
            </div>

            <ul ref={listRef} className="max-h-72 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-slate-500">No matching pages.</li>
              ) : (
                filtered.map((item, index) => {
                  const selected = index === selectedIndex;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        data-index={index}
                        onClick={() => go(item.to)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`flex w-full min-h-11 items-center px-4 py-2.5 text-left text-sm transition-colors ${
                          selected ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-medium">{item.label}</span>
                        <span className="ml-auto truncate pl-4 text-xs text-slate-400">{item.to}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="border-t border-slate-200/90 px-4 py-2 text-xs text-slate-400">
              <span className="hidden sm:inline">Navigate with arrow keys · Enter to open · </span>
              <span>Esc to close</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
