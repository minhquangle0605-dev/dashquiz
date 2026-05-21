export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
  variant?: 'brand' | 'current';
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[2.5px]',
  lg: 'h-12 w-12 border-[3px]',
};

export function Spinner({
  size = 'md',
  className = '',
  label = 'Loading',
  variant = 'brand',
}: SpinnerProps) {
  const colorClass =
    variant === 'brand'
      ? 'border-[var(--color-primary)]/20 border-t-[var(--color-primary)]'
      : 'border-current/30 border-t-current';
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full ${colorClass} ${sizeClasses[size]} ${className}`}
    />
  );
}
