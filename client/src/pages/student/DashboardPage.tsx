import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
import { Line } from 'react-chartjs-2';

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
import { StatTile, type StatTone } from '@/components/shared/StatTile';
import { QuickActionsGrid } from '@/components/shared/QuickActionsGrid';
import {
  getStudentDashboard,
  type StudentDashboardData,
} from '@/services/analytics.api';

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

type TrendPeriod = '30d' | '60d' | '90d';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('30d');

  const fetchData = useCallback(async () => {
    try {
      const dashData = await getStudentDashboard();
      setDashboard(dashData);
    } catch {
      // individual sections remain at defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-[var(--color-text-muted)]">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const totalExams = dashboard?.totalExams ?? 0;
  const avgScore = dashboard?.avgScore ?? 0;
  const lastResult = dashboard?.recentResults?.[0] ?? null;
  const currentTrend = dashboard?.trends?.[trendPeriod];
  const prevTrend = trendPeriod === '30d'
    ? dashboard?.trends?.['60d']
    : trendPeriod === '60d'
      ? dashboard?.trends?.['90d']
      : null;

  const streak = computeStreak(dashboard?.recentResults ?? []);

  const trend30 = dashboard?.trends?.['30d'];
  const trend60 = dashboard?.trends?.['60d'];
  const scoreDelta =
    trend30 && trend60 && trend60.avgScore > 0
      ? ((trend30.avgScore - trend60.avgScore) / trend60.avgScore) * 100
      : undefined;

  const statTiles: Array<{
    label: string;
    value: number | string;
    hint?: string;
    icon: React.ReactNode;
    tone: StatTone;
    deltaPct?: number;
    decimals?: number;
  }> = [
    {
      label: 'Total Exams',
      value: totalExams,
      icon: iconExams,
      tone: 'brand',
      hint: trend30 ? `${trend30.examCount} in last 30 days` : undefined,
    },
    {
      label: 'Average Score',
      value: Number(avgScore.toFixed(1)),
      icon: iconStar,
      tone: 'success',
      deltaPct: scoreDelta,
      hint: scoreDelta !== undefined ? 'vs previous period' : undefined,
      decimals: 1,
    },
    {
      label: 'Latest Exam',
      value: lastResult ? Number(lastResult.score.toFixed(1)) : '--',
      hint: lastResult?.examTitle ?? 'No exams yet',
      icon: iconClipboard,
      tone: 'info',
      decimals: 1,
    },
    {
      label: 'Passing Streak',
      value: streak,
      hint: streak > 0 ? '🔥 Keep it up' : 'No streak yet',
      icon: iconFire,
      tone: 'warning',
    },
  ];

  const quickActions = [
    {
      label: 'Browse exams',
      description: 'See what is available',
      to: '/student/exams',
      icon: iconExams,
      tone: 'brand' as const,
    },
    {
      label: 'My Classes',
      description: 'Resources & activities',
      to: '/student/classes',
      icon: iconClasses,
      tone: 'info' as const,
    },
  ];

  // Score trend line chart data
  const trendChartData = buildTrendChart(dashboard, trendPeriod);

  return (
    <div className="space-y-6">
      {/* Hero banner — personalized greeting + at-a-glance meta */}
      <GreetingBanner
        subtitle="Track your learning progress, analyze strengths and weaknesses, and keep practicing with AI."
        meta={[
          { label: 'Avg score', value: avgScore.toFixed(1), tone: 'success' },
          { label: 'Streak', value: streak, tone: 'warning' },
          { label: 'Exams', value: totalExams, tone: 'brand' },
        ]}
      />

      {/* Quick actions */}
      <QuickActionsGrid
        title="Quick actions"
        subtitle="Jump right back in"
        actions={quickActions}
      />

      {/* Row 1: Stat Tiles */}
      <div className="grid grid-cols-1 gap-4 stagger sm:grid-cols-2 xl:grid-cols-4">
        {statTiles.map((s) => (
          <StatTile
            key={s.label}
            label={s.label}
            value={s.value}
            hint={s.hint}
            icon={s.icon}
            tone={s.tone}
            deltaPct={s.deltaPct}
            decimals={s.decimals}
          />
        ))}
      </div>

      {/* Row 2: Score Trend */}
      <div className="grid grid-cols-1 gap-6">
        {/* Line chart — score trend */}
        <Card padding="md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
              Score Trend
            </h3>
            <div className="inline-flex gap-1 rounded-xl bg-[var(--color-bg-muted)] p-1">
              {(['30d', '60d', '90d'] as TrendPeriod[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTrendPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    trendPeriod === p
                      ? 'bg-[var(--color-bg-card)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {p.replace('d', ' days')}
                </button>
              ))}
            </div>
          </div>
          <div className="h-56">
            {trendChartData ? (
              <Line data={trendChartData} options={lineChartOptions} />
            ) : (
              <EmptyChart message="No score data available yet" />
            )}
          </div>
          {currentTrend && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="text-[var(--color-text-muted)]">
                Avg: <span className="font-bold tabular-nums text-[var(--color-text-primary)]">{currentTrend.avgScore.toFixed(1)}</span>
              </span>
              <span className="text-[var(--color-text-muted)]">
                Exams: <span className="font-bold tabular-nums text-[var(--color-text-primary)]">{currentTrend.examCount}</span>
              </span>
              {prevTrend && prevTrend.avgScore > 0 && (
                <TrendBadge current={currentTrend.avgScore} previous={prevTrend.avgScore} />
              )}
            </div>
          )}
        </Card>

      </div>

      {/* Row 3: Recent History */}
      <div className="grid grid-cols-1 gap-6">
        {/* Recent Exam History */}
        <Card padding="none">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-6 py-4">
            <h3 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
              Recent Exams
            </h3>
            <Link
              to="/student/exams"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft)]"
            >
              View all
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>

          {(!dashboard?.recentResults || dashboard.recentResults.length === 0) ? (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                No exams taken yet
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Start your first exam to see results here.
              </p>
            </div>
          ) : (
            <div className="p-2">
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
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          to={`/student/attempts/${r.id}/result`}
                          className="font-semibold text-[var(--color-primary)] hover:underline"
                        >
                          {r.examTitle}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" size="sm">
                          {r.subjectName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`tabular-nums font-bold ${
                            r.score >= 5 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                          }`}
                        >
                          {r.score.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(r.submittedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function computeStreak(results: { score: number }[]): number {
  let count = 0;
  for (const r of results) {
    if (r.score >= 5) count++;
    else break;
  }
  return count;
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : 0;
  const isUp = diff > 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        isUp
          ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
          : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
      }`}
    >
      <svg className={`h-3 w-3 ${isUp ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 3l-7 7h4v7h6v-7h4l-7-7z" />
      </svg>
      {isUp ? '+' : ''}{pct}%
    </span>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <svg className="mx-auto h-10 w-10 text-[var(--color-border-strong)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// CHART BUILDERS
// ═══════════════════════════════════════════════════

function buildTrendChart(dashboard: StudentDashboardData | null, _period: TrendPeriod) {
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

// ═══════════════════════════════════════════════════
// CHART OPTIONS
// ═══════════════════════════════════════════════════

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      cornerRadius: 8,
      padding: 10,
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 }, color: '#94a3b8' },
    },
    y: {
      min: 0,
      max: 10,
      ticks: { font: { size: 11 }, color: '#94a3b8', stepSize: 2 },
      grid: { color: '#f1f5f9' },
    },
  },
} as const;

// ═══════════════════════════════════════════════════
// ICONS (inline SVG to match admin dashboard pattern)
// ═══════════════════════════════════════════════════

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

const iconFire = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
  </svg>
);

const iconClasses = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM7 12a3 3 0 100-6 3 3 0 000 6z" />
  </svg>
);

