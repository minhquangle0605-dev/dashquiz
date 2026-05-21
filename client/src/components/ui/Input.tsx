import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      hint,
      error,
      leftIcon,
      rightIcon,
      id,
      containerClassName = '',
      className = '',
      ...rest
    },
    ref
  ) {
    const inputId = id ?? rest.name;

    const wrapperBase =
      'group relative flex items-center w-full rounded-xl border bg-[var(--color-bg-input)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-150';
    const wrapperState = error
      ? 'border-[var(--color-danger)] focus-within:border-[var(--color-danger)] focus-within:shadow-[var(--ring-danger)]'
      : 'border-[var(--color-border)] focus-within:border-[var(--color-primary)] focus-within:shadow-[var(--ring-brand)] hover:border-[var(--color-border-strong)]';

    return (
      <div className={containerClassName}>
        {label !== undefined && label !== '' && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <div className={`${wrapperBase} ${wrapperState}`}>
          {leftIcon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--color-text-muted)] [&>svg]:h-4 [&>svg]:w-4">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error && inputId ? `${inputId}-error` : undefined}
            className={`peer w-full bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none ${leftIcon ? 'pl-0' : 'pl-3.5'} ${rightIcon ? 'pr-0' : 'pr-3.5'} h-10 ${className}`}
            {...rest}
          />
          {rightIcon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--color-text-muted)] [&>svg]:h-4 [&>svg]:w-4">
              {rightIcon}
            </span>
          )}
        </div>
        {error !== undefined && error !== '' ? (
          <p
            id={inputId ? `${inputId}-error` : undefined}
            className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[var(--color-danger)]"
            role="alert"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
