import { isValidElement, type ReactNode } from 'react';

export type EmptyStateActionConfig = {
  label: string;
  onClick: () => void;
};

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateActionConfig | ReactNode;
};

function DefaultEmptyIcon() {
  return (
    <svg
      className="h-12 w-12 text-slate-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.25}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );
}

function isActionConfig(action: EmptyStateActionConfig | ReactNode): action is EmptyStateActionConfig {
  return (
    typeof action === 'object' &&
    action !== null &&
    !isValidElement(action) &&
    'label' in action &&
    'onClick' in action &&
    typeof (action as EmptyStateActionConfig).label === 'string' &&
    typeof (action as EmptyStateActionConfig).onClick === 'function'
  );
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
        {icon ?? <DefaultEmptyIcon />}
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-slate-500 sm:text-base">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-6">
          {isActionConfig(action) ? (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {action.label}
            </button>
          ) : (
            action
          )}
        </div>
      ) : null}
    </div>
  );
}
