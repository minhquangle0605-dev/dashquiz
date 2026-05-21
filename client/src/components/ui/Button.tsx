import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'ghost'
  | 'outline'
  | 'subtle';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-brand text-white shadow-[var(--shadow-brand)] hover:brightness-110 hover:shadow-[var(--shadow-lg)] active:brightness-95 disabled:bg-none disabled:bg-[var(--color-bg-muted)] disabled:text-[var(--color-text-muted)] disabled:shadow-none focus-ring-brand',
  secondary:
    'bg-[var(--color-secondary-soft)] text-[var(--color-secondary)] hover:bg-[color-mix(in_srgb,var(--color-secondary-soft)_70%,var(--color-secondary)_8%)] active:brightness-95 disabled:opacity-50 focus-ring-brand',
  danger:
    'bg-[var(--color-danger)] text-[var(--color-on-danger)] shadow-sm hover:brightness-110 active:brightness-95 disabled:opacity-50 focus-ring-danger',
  success:
    'bg-[var(--color-success)] text-[var(--color-on-success)] shadow-sm hover:brightness-110 active:brightness-95 disabled:opacity-50 focus-ring-brand',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)] active:brightness-95 disabled:opacity-50 focus-ring-brand',
  outline:
    'border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] active:brightness-95 disabled:opacity-50 focus-ring-brand',
  subtle:
    'bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[var(--color-primary-soft-strong)] active:brightness-95 disabled:opacity-50 focus-ring-brand',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-5 text-base rounded-xl gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) {
    const base =
      'group relative inline-flex items-center justify-center font-semibold tracking-tight whitespace-nowrap transition-[transform,box-shadow,background-color,filter,color] duration-150 ease-out will-change-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100';

    const width = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled ?? isLoading}
        className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${width} ${className}`}
        {...rest}
      >
        {isLoading ? (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        ) : (
          leftIcon && <span className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">{leftIcon}</span>
        )}
        {children && <span className="truncate">{children}</span>}
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
