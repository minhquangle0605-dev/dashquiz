import { Badge } from '@/components/ui/Badge';
import type { ClassActivity, ClassResource } from '@/types/exam';

interface CourseBlockProps {
  title: string;
  subtitle?: string | null;
  resources: ClassResource[];
  activities: ClassActivity[];
  hidden?: boolean;
  deletingSection?: boolean;
  deletingResourceId?: number | null;
  onDeleteSection?: () => void;
  onOpenResource?: (resource: ClassResource) => void;
  onDeleteResource?: (resource: ClassResource) => void;
}

export function CourseBlock({
  title,
  subtitle,
  resources,
  activities,
  hidden,
  deletingSection,
  deletingResourceId,
  onDeleteSection,
  onOpenResource,
  onDeleteResource,
}: CourseBlockProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hidden && <Badge variant="warning" size="sm">Hidden</Badge>}
          {onDeleteSection && (
            <button
              type="button"
              disabled={deletingSection}
              onClick={onDeleteSection}
              className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingSection ? 'Deleting...' : 'Delete Section'}
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            Resources ({resources.length})
          </p>
          {resources.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border-subtle)] py-3 text-center text-xs text-[var(--color-text-muted)]">
              No resources
            </p>
          ) : (
            <ul className="space-y-2">
              {resources.map((resource) => (
                <li
                  key={resource.id}
                  className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2 transition-colors hover:border-[var(--color-border)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {resource.title}
                    </span>
                    <Badge
                      variant={resource.isPublished ? 'success' : 'warning'}
                      size="sm"
                    >
                      {resource.type}
                    </Badge>
                  </div>
                  {resource.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">
                      {resource.description}
                    </p>
                  )}
                  {(resource.type === 'FILE' || resource.type === 'IMAGE' || resource.type === 'LINK' || resource.type === 'VIDEO' || onDeleteResource) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {(resource.type === 'FILE' || resource.type === 'IMAGE' || resource.type === 'LINK' || resource.type === 'VIDEO') && onOpenResource && (
                        <button
                          type="button"
                          onClick={() => onOpenResource(resource)}
                          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                        >
                          {resource.type === 'FILE' ? 'Download' : 'Open'}
                        </button>
                      )}
                      {onDeleteResource && (
                        <button
                          type="button"
                          disabled={deletingResourceId === resource.id}
                          onClick={() => onDeleteResource(resource)}
                          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingResourceId === resource.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            Activities ({activities.length})
          </p>
          {activities.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border-subtle)] py-3 text-center text-xs text-[var(--color-text-muted)]">
              No activities
            </p>
          ) : (
            <ul className="space-y-2">
              {activities.map((activity) => (
                <li
                  key={activity.id}
                  className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2 transition-colors hover:border-[var(--color-border)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {activity.title}
                    </span>
                    <Badge
                      variant={activity.status === 'PUBLISHED' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {activity.type}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {activity.dueAt
                      ? `Due ${new Date(activity.dueAt).toLocaleString()}`
                      : 'No deadline'}
                    {activity.maxScore !== null && activity.maxScore !== undefined
                      ? ` · ${activity.maxScore} pts`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
