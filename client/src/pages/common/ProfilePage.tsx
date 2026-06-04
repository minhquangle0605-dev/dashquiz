import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';

export default function ProfilePage() {
  const { user } = useAuth();
  const displayName = user?.fullName || user?.username || 'User';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card padding="lg">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-200 to-slate-400 text-2xl font-bold text-white shadow-inner">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div className="w-full min-w-0 text-center sm:text-left">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  Profile
                </h1>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Account information and learning progress.
                </p>
              </div>
              {user?.role ? (
                <Badge variant="brand" className="self-center capitalize sm:self-auto">
                  {user.role}
                </Badge>
              ) : null}
            </div>

            <dl className="mt-6 grid gap-3 text-left text-sm sm:grid-cols-2">
              <InfoBox label="Full Name" value={user?.fullName || '--'} />
              <InfoBox label="Username" value={user?.username || '--'} />
            </dl>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-bg-subtle)] px-3 py-2">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="font-medium text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
}
