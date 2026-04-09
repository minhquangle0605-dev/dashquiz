import type { HTMLAttributes } from 'react';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = '', ...rest }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200 ${className}`}
      {...rest}
    />
  );
}

export type SkeletonTableProps = HTMLAttributes<HTMLDivElement> & {
  columns?: number;
  rows?: number;
};

export function SkeletonTable({
  className = '',
  columns = 4,
  rows = 5,
  ...rest
}: SkeletonTableProps) {
  return (
    <div className={`w-full space-y-3 ${className}`} {...rest}>
      <div className="flex gap-3 border-b border-slate-200 pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 flex-1 rounded" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={`r-${ri}`} className="flex gap-3">
          {Array.from({ length: columns }).map((_, ci) => (
            <Skeleton key={`c-${ri}-${ci}`} className="h-3 flex-1 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

export type SkeletonCardProps = HTMLAttributes<HTMLDivElement>;

export function SkeletonCard({ className = '', ...rest }: SkeletonCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
      {...rest}
    >
      <Skeleton className="mb-4 h-5 w-2/5 max-w-xs rounded" />
      <Skeleton className="mb-6 h-3 w-3/5 max-w-md rounded" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-4/5 rounded" />
      </div>
    </div>
  );
}

export type SkeletonChartProps = HTMLAttributes<HTMLDivElement>;

export function SkeletonChart({ className = '', ...rest }: SkeletonChartProps) {
  return (
    <div className={`space-y-4 ${className}`} {...rest}>
      <div className="flex items-end justify-between gap-2">
        <Skeleton className="h-4 w-32 rounded" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="flex justify-center gap-6">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-20 rounded-full" />
      </div>
    </div>
  );
}

export type SkeletonListProps = HTMLAttributes<HTMLDivElement> & {
  items?: number;
};

export function SkeletonList({
  className = '',
  items = 5,
  ...rest
}: SkeletonListProps) {
  return (
    <div className={`space-y-4 ${className}`} {...rest}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5 max-w-xs rounded" />
            <Skeleton className="h-3 w-full max-w-md rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
