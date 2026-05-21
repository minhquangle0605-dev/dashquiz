import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Lightweight, accessible dropdown menu (popover anchored to a trigger).
 * Inspired by shadcn/ui's DropdownMenu primitive (Radix-style):
 *   https://github.com/shadcn-ui/ui/blob/main/apps/www/registry/default/ui/dropdown-menu.tsx
 * Built without a dependency to stay light, but supports:
 *   - keyboard navigation (Esc, ArrowDown/ArrowUp, Enter)
 *   - click-outside to dismiss
 *   - anchored positioning (auto flip if near viewport edge)
 *   - portal rendering to avoid clipping
 */

type Align = 'start' | 'center' | 'end';

export interface DropdownMenuProps {
  trigger: ReactElement;
  children: ReactNode;
  align?: Align;
  side?: 'top' | 'bottom';
  width?: number | string;
  className?: string;
  /** Controlled mode (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DropdownMenu({
  trigger,
  children,
  align = 'end',
  side = 'bottom',
  width = 240,
  className = '',
  open: openProp,
  onOpenChange,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<CSSProperties>({});
  const menuId = useId();

  // Compute position
  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const w =
      typeof width === 'number'
        ? width
        : menuRef.current?.offsetWidth ?? rect.width;
    const gap = 8;

    let left = rect.left;
    if (align === 'end') left = rect.right - w;
    else if (align === 'center') left = rect.left + rect.width / 2 - w / 2;

    // Edge clamp
    const vw = window.innerWidth;
    if (left + w + 8 > vw) left = vw - w - 8;
    if (left < 8) left = 8;

    let top = rect.bottom + gap;
    if (side === 'top') {
      top = rect.top - gap - (menuRef.current?.offsetHeight ?? 0);
    }

    // Vertical flip
    const vh = window.innerHeight;
    const menuH = menuRef.current?.offsetHeight ?? 0;
    if (side === 'bottom' && top + menuH > vh - 8) {
      top = Math.max(8, rect.top - gap - menuH);
    }

    setPos({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: typeof width === 'number' ? `${width}px` : width,
    });
  }, [align, side, width]);

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

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  // Inject ref + handlers into trigger
  const triggerProps = useMemo(() => {
    const props: HTMLAttributes<HTMLElement> & {
      ref: (n: HTMLElement | null) => void;
      'aria-haspopup': 'menu';
      'aria-expanded': boolean;
      'aria-controls'?: string;
    } = {
      ref: (n: HTMLElement | null) => {
        triggerRef.current = n;
      },
      onClick: (e) => {
        const original = (trigger.props as { onClick?: (e: unknown) => void })
          .onClick;
        original?.(e);
        setOpen(!open);
      },
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      'aria-controls': open ? menuId : undefined,
    };
    return props;
  }, [trigger, open, setOpen, menuId]);

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger, triggerProps as Partial<typeof trigger.props>)
    : trigger;

  return (
    <>
      {triggerEl}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                id={menuId}
                role="menu"
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                style={pos}
                className={`z-[60] origin-top overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1.5 shadow-[var(--shadow-xl)] backdrop-blur ${className}`}
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

export interface DropdownItemProps
  extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  icon?: ReactNode;
  shortcut?: string;
  destructive?: boolean;
  children: ReactNode;
  disabled?: boolean;
}

export function DropdownItem({
  icon,
  shortcut,
  destructive = false,
  children,
  className = '',
  disabled,
  ...rest
}: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        destructive
          ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]'
          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)]'
      } ${className}`}
      {...rest}
    >
      {icon && (
        <span
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4 ${
            destructive
              ? 'text-[var(--color-danger)]'
              : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]'
          }`}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && (
        <kbd className="ml-auto rounded border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[var(--color-text-muted)]">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

export function DropdownSeparator({ className = '' }: { className?: string }) {
  return (
    <div
      role="separator"
      className={`my-1 h-px bg-[var(--color-border-subtle)] ${className}`}
    />
  );
}

export function DropdownLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] ${className}`}
    >
      {children}
    </div>
  );
}
