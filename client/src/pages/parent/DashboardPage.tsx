import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/Table';
import { GreetingBanner } from '@/components/shared/GreetingBanner';
import { StatTile } from '@/components/shared/StatTile';
import { QuickActionsGrid } from '@/components/shared/QuickActionsGrid';
import { getChildren, getChildDashboard, getChildStrengths } from '@/services/parent.api';
import type { ChildDashboardData } from '@/types/parent';
import type { StrengthItem } from '@/services/analytics.api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
);

export default function DashboardPage() {
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

  const { data: children = [], isLoading: loadingChildren } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: getChildren,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].student.id);
    }
  }, [children, selectedChildId]);

  const selectedChild = children.find((c) => c.student.id === selectedChildId);

  if (loadingChildren) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return <NoChildrenView />;
  }

  return (
    <div className="space-y-6">
      <GreetingBanner
        subtitle={
          children.length > 1
            ? `You are following ${children.length} children. Select a student to view details.`
            : `Track the learning progress of ${selectedChild?.student.fullName ?? 'your child'} here.`
        }
        meta={
          selectedChild
            ? [{ label: 'Viewing', value: selectedChild.student.fullName, tone: 'warning' }]
            : undefined
        }
        action={
          children.length > 1 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm ring-1 ring-white/20">
              <label htmlFor="child-select" className="text-xs font-semibold uppercase tracking-wider text-white/80">
                Child
              </label>
              <select
                id="child-select"
                value={selectedChildId ?? ''}
                onChange={(e) => setSelectedChildId(Number(e.target.value))}
                className="min-w-[10rem] rounded-lg border border-white/30 bg-white/15 px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-slate-900"
              >
                {children.map((child) => (
                  <option key={child.student.id} value={child.student.id}>
                    {child.student.fullName}
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      <QuickActionsGrid
        title="Quick actions"
        actions={[
          {
            label: "Child's results",
            description: 'Detailed history per exam',
            to: '/parent/results',
            icon: iconClipboard,
            tone: 'brand',
          },
          {
            label: 'Notifications',
            description: 'Updates from school',
            to: '/parent/notifications',
            icon: iconBell,
            tone: 'warning',
          },
          {
            label: 'Profile',
            description: 'Account & contact',
            to: '/parent/profile',
            icon: iconStar,
            tone: 'accent',
          },
        ]}
      />

      {selectedChildId && <ChildDashboardContent childId={selectedChildId} />}
    </div>
  );
}

function ChildDashboardContent({ childId }: { childId: number }) {
  const [dashboard, setDashboard] = useState<ChildDashboardData | null>(null);
  const [strengths, setStrengths] = useState<StrengthItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashData, strengthData] = await Promise.allSettled([
        getChildDashboard(childId),
        getChildStrengths(childId),
      ]);
      if (dashData.status === 'fulfilled') setDashboard(dashData.value);
      else setDashboard(null);
      if (strengthData.status === 'fulfilled') setStrengths(strengthData.value);
      else setStrengths([]);
    } catch {
      // sections remain empty
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading child's data...</p>
        </div>
      </div>
    );
  }

  const totalExams = dashboard?.totalExams ?? 0;
  const avgScore = dashboard?.avgScore ?? 0;
  const lastResult = dashboard?.recentResults?.[0] ?? null;

  const statTiles = [
    {
      label: 'Total Exams',
      value: totalExams,
      icon: iconExams,
      tone: 'brand' as const,
    },
    {
      label: 'Average Score',
      value: Number(avgScore.toFixed(1)),
      icon: iconStar,
      tone: 'success' as const,
      decimals: 1,
    },
    {
      label: 'Latest Exam',
      value: lastResult ? Number(lastResult.score.toFixed(1)) : '--',
      hint: lastResult?.examTitle ?? 'No exams yet',
      icon: iconClipboard,
      tone: 'info' as const,
      decimals: 1,
    },
    {
      label: 'Max Score',
      value: dashboard?.maxScore ? Number(dashboard.maxScore.toFixed(1)) : '--',
      icon: iconTrophy,
      tone: 'warning' as const,
      decimals: 1,
    },
  ];

  const trendChartData = buildTrendChart(dashboard);
  const radarData = buildRadarChart(strengths);

  return (
    <>
      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-4 stagger sm:grid-cols-2 xl:grid-cols-4">
        {statTiles.map((s) => (
          <StatTile
            key={s.label}
            label={s.label}
            value={s.value}
            hint={s.hint}
            icon={s.icon}
            tone={s.tone}
            decimals={s.decimals}
          />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="md">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Score Trend</h3>
          <div className="h-56">
            {trendChartData ? (
              <Line data={trendChartData} options={lineChartOptions} />
            ) : (
              <EmptyChart message="No score data available yet" />
            )}
          </div>
        </Card>

        <Card padding="md">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Strengths & Weaknesses</h3>
          <div className="h-56">
            {radarData ? (
              <Radar data={radarData} options={radarChartOptions} />
            ) : (
              <EmptyChart message="No topic data available yet" />
            )}
          </div>
          {strengths.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {strengths.slice(0, 3).map((s) => (
                <Badge key={s.topicId} variant="success">
                  {s.topicName}: {s.accuracy}%
                </Badge>
              ))}
              {strengths.length > 3 &&
                strengths.slice(-2).map((s) => (
                  <Badge key={s.topicId} variant="danger">
                    {s.topicName}: {s.accuracy}%
                  </Badge>
                ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent exams */}
      <Card padding="none">
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <h3 className="text-lg font-semibold text-slate-900">Recent Exams</h3>
          <Link
            to="/parent/results"
            className="min-h-[44px] inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            View all results
          </Link>
        </div>

        {(!dashboard?.recentResults || dashboard.recentResults.length === 0) ? (
          <div className="flex flex-col items-center justify-center pb-8 pt-4 text-center">
            <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 text-sm text-slate-500">No exams taken yet.</p>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Exam</TableHeaderCell>
                <TableHeaderCell>Subject</TableHeaderCell>
                <TableHeaderCell>Score</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dashboard.recentResults.slice(0, 5).map((r) => (
                <TableRow key={r.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell>
                    <span className="font-medium text-slate-900">{r.examTitle}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{r.subjectName}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`font-semibold ${r.score >= 5 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {r.score.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-500">
                      {new Date(r.submittedAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

function NoChildrenView() {
  return (
    <div className="mx-auto max-w-lg py-12">
      <Card padding="lg">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Student profile not found</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your parent account is linked directly to a student account.
            Please contact a teacher or administrator if you don't see any data.
          </p>
        </div>
      </Card>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <svg className="mx-auto h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
    </div>
  );
}

function buildTrendChart(dashboard: ChildDashboardData | null) {
  const results = dashboard?.recentResults;
  if (!results || results.length === 0) return null;

  const reversed = [...results].reverse();
  return {
    labels: reversed.map((r) => {
      const d = new Date(r.submittedAt);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }),
    datasets: [
      {
        label: 'Score',
        data: reversed.map((r) => r.score),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#4f46e5',
      },
    ],
  };
}

function buildRadarChart(strengths: StrengthItem[]) {
  if (strengths.length === 0) return null;

  const top = strengths.slice(0, 8);
  return {
    labels: top.map((s) => s.topicName.length > 14 ? s.topicName.slice(0, 14) + '...' : s.topicName),
    datasets: [
      {
        label: 'Accuracy (%)',
        data: top.map((s) => s.accuracy),
        backgroundColor: 'rgba(79, 70, 229, 0.15)',
        borderColor: '#4f46e5',
        borderWidth: 2,
        pointBackgroundColor: '#4f46e5',
        pointRadius: 3,
      },
    ],
  };
}

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#1e293b', cornerRadius: 8, padding: 10 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
    y: {
      min: 0,
      max: 10,
      ticks: { font: { size: 11 }, color: '#94a3b8', stepSize: 2 },
      grid: { color: '#f1f5f9' },
    },
  },
} as const;

const radarChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#1e293b', cornerRadius: 8 },
  },
  scales: {
    r: {
      beginAtZero: true,
      max: 100,
      ticks: { stepSize: 25, display: false },
      grid: { color: '#e2e8f0' },
      pointLabels: { font: { size: 10 }, color: '#475569' },
    },
  },
} as const;

const iconExams = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const iconStar = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const iconClipboard = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);
const iconTrophy = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a9.014 9.014 0 01-1.772.483" />
  </svg>
);
const iconBell = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
);
