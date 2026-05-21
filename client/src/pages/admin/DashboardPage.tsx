import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { GreetingBanner } from '@/components/shared/GreetingBanner';
import { StatTile, type StatTone } from '@/components/shared/StatTile';
import { QuickActionsGrid } from '@/components/shared/QuickActionsGrid';
import { getMonitoring, listActivityLogs } from '@/services/admin.api';
import api from '@/services/api';
import type { MonitoringData, ActivityLog } from '@/types/admin';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalExams: 0,
    totalSubjects: 0,
    totalQuestions: 0,
  });
  const [monitoring, setMonitoring] = useState<MonitoringData | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const [monData, logsData] = await Promise.allSettled([
        getMonitoring(),
        listActivityLogs({ page: 1, pageSize: 8, sortOrder: 'desc' }),
      ]);

      if (monData.status === 'fulfilled') setMonitoring(monData.value);
      if (logsData.status === 'fulfilled') {
        const result = logsData.value;
        setRecentLogs(Array.isArray(result) ? result : result.items ?? []);
      }

      try {
        const [usersRes, examsRes, subjectsRes, questionsRes] = await Promise.allSettled([
          api.get('/api/admin/users', { params: { page: 1, pageSize: 1 } }),
          api.get('/api/exams', { params: { page: 1, pageSize: 1 } }),
          api.get('/api/admin/academic/subjects'),
          api.get('/api/questions', { params: { page: 1, pageSize: 1 } }),
        ]);

        setStats({
          totalUsers: usersRes.status === 'fulfilled'
            ? (usersRes.value.data?.data?.total ?? usersRes.value.data?.total ?? 0)
            : 0,
          totalExams: examsRes.status === 'fulfilled'
            ? (examsRes.value.data?.data?.total ?? examsRes.value.data?.total ?? 0)
            : 0,
          totalSubjects: subjectsRes.status === 'fulfilled'
            ? (Array.isArray(subjectsRes.value.data?.data)
                ? subjectsRes.value.data.data.length
                : Array.isArray(subjectsRes.value.data)
                  ? subjectsRes.value.data.length
                  : 0)
            : 0,
          totalQuestions: questionsRes.status === 'fulfilled'
            ? (questionsRes.value.data?.data?.total ?? questionsRes.value.data?.total ?? 0)
            : 0,
        });
      } catch {
        // stats remain at default
      }
    } catch {
      // silently fail individual sections
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const statTiles: Array<{ label: string; value: number; icon: React.ReactNode; tone: StatTone }> = [
    {
      label: 'Total Users',
      value: stats.totalUsers,
      tone: 'info',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      label: 'Total Exams',
      value: stats.totalExams,
      tone: 'accent',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Subjects',
      value: stats.totalSubjects,
      tone: 'success',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      label: 'Questions',
      value: stats.totalQuestions,
      tone: 'warning',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const quickActions = [
    {
      label: 'Manage users',
      description: 'Roles, status, accounts',
      to: '/admin/users',
      tone: 'brand' as const,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      label: 'Question bank',
      description: 'Library & categories',
      to: '/admin/questions',
      tone: 'accent' as const,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      label: 'Academic',
      description: 'Subjects, years, semesters',
      to: '/admin/academic',
      tone: 'success' as const,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      label: 'System',
      description: 'Monitoring, backups, configs',
      to: '/admin/system',
      tone: 'warning' as const,
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const cpuPct = monitoring?.cpu?.usage ?? 0;
  const memPct = monitoring?.memory?.percentage ?? 0;
  const uptimeHours = monitoring?.uptime ? Math.floor(monitoring.uptime / 3600) : 0;
  const uptimeMins = monitoring?.uptime ? Math.floor((monitoring.uptime % 3600) / 60) : 0;

  const healthTone =
    cpuPct > 85 || memPct > 85 ? 'danger' : cpuPct > 60 || memPct > 60 ? 'warning' : 'success';
  const healthLabel =
    healthTone === 'danger' ? 'Critical' : healthTone === 'warning' ? 'Warning' : 'Healthy';

  return (
    <div className="space-y-6">
      <GreetingBanner
        subtitle="System status, users, exams, and recent activity – at a glance."
        meta={[
          { label: 'CPU', value: `${Math.round(cpuPct)}%`, tone: 'info' },
          { label: 'Memory', value: `${Math.round(memPct)}%`, tone: 'warning' },
          {
            label: 'Status',
            value: healthLabel,
            tone: healthTone === 'success' ? 'success' : healthTone === 'warning' ? 'warning' : 'neutral',
          },
        ]}
      />

      <QuickActionsGrid title="Quick actions" actions={quickActions} />

      {/* Stat Tiles */}
      <div className="grid grid-cols-1 gap-4 stagger sm:grid-cols-2 xl:grid-cols-4">
        {statTiles.map((s) => (
          <StatTile
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            tone={s.tone}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* System Health */}
        <Card title="System Health" padding="md" className="lg:col-span-1">
          <div className="space-y-5">
            <HealthBar label="CPU Usage" value={cpuPct} color="blue" />
            <HealthBar label="Memory Usage" value={memPct} color="emerald" />
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-600">Uptime</span>
              <span className="text-sm font-semibold text-slate-900">
                {uptimeHours}h {uptimeMins}m
              </span>
            </div>
            {monitoring?.nodeVersion && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">Node.js</span>
                <Badge variant="info">{monitoring.nodeVersion}</Badge>
              </div>
            )}
            {monitoring?.platform && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">Platform</span>
                <Badge variant="neutral">{monitoring.platform}</Badge>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card title="Recent Activity" padding="none" className="lg:col-span-2">
          {recentLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-3 text-sm text-slate-500">No recent activity found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="px-6 pt-5 pb-3">
                <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
              </div>
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-6 py-3 hover:bg-slate-50 transition-colors">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">
                        {log.user?.fullName ?? log.user?.username ?? 'System'}
                      </span>
                      {' '}
                      <span className="text-slate-500">{log.action}</span>
                      {log.entityType && (
                        <Badge variant="neutral" className="ml-2">{log.entityType}</Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                      {log.ipAddress && ` · ${log.ipAddress}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function HealthBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const barColorClass =
    pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : `bg-${color}-500`;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className={`text-sm font-bold ${pct > 85 ? 'text-red-600' : pct > 60 ? 'text-amber-600' : `text-${color}-600`}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
