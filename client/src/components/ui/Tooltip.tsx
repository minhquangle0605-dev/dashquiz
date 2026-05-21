import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Minimal accessible tooltip — keyboard focusable, portal-rendered.
 * Pattern inspired by Radix Tooltip (used in shadcn/ui):
 *   https://github.com/shadcn-ui/ui/blob/main/apps/www/registry/default/ui/tooltip.tsx
 */

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 200,
  className = '',
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const tipId = useId();

  const reposition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const w = tooltipRef.current.offsetWidth;
    const h = tooltipRef.current.offsetHeight;
    const gap = 8;
    let top = 0;
    let left = 0;
    switch (side) {
      case 'top':
        top = t.top - h - gap;
        left = t.left + t.width / 2 - w / 2;
        break;
      case 'bottom':
        top = t.bottom + gap;
        left = t.left + t.width / 2 - w / 2;
        break;
      case 'left':
        top = t.top + t.height / 2 - h / 2;
        left = t.left - w - gap;
        break;
      case 'right':
        top = t.top + t.height / 2 - h / 2;
        left = t.right + gap;
        break;
    }
    // clamp
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left + w + 8 > vw) left = vw - w - 8;
    if (left < 8) left = 8;
    if (top + h + 8 > vh) top = vh - h - 8;
    if (top < 8) top = 8;
    setPos({ position: 'fixed', top: `${top}px`, left: `${left}px` });
  }, [side]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, reposition]);

  const show = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!isValidElement(children)) return children;

  const triggerEl = cloneElement(children, {
    ref: (n: HTMLElement | null) => {
      triggerRef.current = n;
    },
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    'aria-describedby': open ? tipId : undefined,
  } as Partial<typeof children.props>);

  return (
    <>
      {triggerEl}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={tooltipRef}
                id={tipId}
                role="tooltip"
                initial={{ opacity: 0, scale: 0.95, y: side === 'top' ? 2 : -2 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: side === 'top' ? 2 : -2 }}
                transition={{ duration: 0.12 }}
                style={pos}
                className={`pointer-events-none z-[70] max-w-xs rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-slate-100 dark:text-slate-900 ${className}`}
              >
                {content}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
