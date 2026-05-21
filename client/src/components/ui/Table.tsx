import type { ReactNode, HTMLAttributes } from 'react';

export interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div
      className={`overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] ${className}`}
    >
      <table className="min-w-full divide-y divide-[var(--color-border-subtle)] text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export interface TableHeadProps {
  children: ReactNode;
  className?: string;
}

export function TableHead({ children, className = '' }: TableHeadProps) {
  return (
    <thead
      className={`bg-[var(--color-bg-subtle)] text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] ${className}`}
    >
      {children}
    </thead>
  );
}

export interface TableBodyProps {
  children: ReactNode;
  className?: string;
}

export function TableBody({ children, className = '' }: TableBodyProps) {
  return (
    <tbody className={`divide-y divide-[var(--color-border-subtle)] bg-[var(--color-bg-card)] ${className}`}>
      {children}
    </tbody>
  );
}

export type TableRowProps = HTMLAttributes<HTMLTableRowElement>;

export function TableRow({ children, className = '', ...rest }: TableRowProps) {
  return (
    <tr
      className={`transition-colors hover:bg-[var(--color-bg-subtle)] ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

export interface TableHeaderCellProps {
  children: ReactNode;
  className?: string;
}

export function TableHeaderCell({
  children,
  className = '',
}: TableHeaderCellProps) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 ${className}`}
    >
      {children}
    </th>
  );
}

export interface TableCellProps {
  children: ReactNode;
  className?: string;
}

export function TableCell({ children, className = '' }: TableCellProps) {
  return (
    <td className={`px-4 py-3 text-[var(--color-text-secondary)] ${className}`}>{children}</td>
  );
}
