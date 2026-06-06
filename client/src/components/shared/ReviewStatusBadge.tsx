import type { ReviewStatus } from '@/types/question';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  needs_review: { label: 'Needs review', cls: 'bg-amber-100 text-amber-700' },
  needs_revision: { label: 'Needs revision', cls: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Approved', cls: 'bg-sky-100 text-sky-700' },
  good: { label: 'Good', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

/** Review-status options for filter/bulk dropdowns. */
export const REVIEW_STATUS_OPTIONS: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'needs_review', label: 'Needs review' },
  { value: 'needs_revision', label: 'Needs revision' },
  { value: 'approved', label: 'Approved' },
  { value: 'good', label: 'Good' },
  { value: 'rejected', label: 'Rejected' },
];

/** Small colored badge for a question's review status (null = needs review). */
export function ReviewStatusBadge({ status }: { status?: string | null }) {
  const meta = STATUS_META[status || 'needs_review'] ?? STATUS_META.needs_review;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
  );
}
