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
import { Line, Radar, Bar } from 'react-chartjs-2';

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
import {
  getStudentDashboard,
  getStudentStrengths,
  getStudentTimeAnalysis,
  type StudentDashboardData,
  type StrengthItem,
  type TimeAnalysisData,
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
  const [strengths, setStrengths] = useState<StrengthItem[]>([]);
  const [timeData, setTimeData] = useState<TimeAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('30d');

  const fetchData = useCallback(async () => {
    try {
      const [dashData, strengthData, timeResult] = await Promise.allSettled([
        getStudentDashboard(),
        getStudentStrengths(),
        getStudentTimeAnalysis(),
      ]);

      if (dashData.status === 'fulfilled') setDashboard(dashData.value);
      if (strengthData.status === 'fulfilled') setStrengths(strengthData.value);
      if (timeResult.status === 'fulfilled') setTimeData(timeResult.value);
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
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
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

  const statCards = [
    {
      label: 'Total Exams',
      value: totalExams,
      icon: iconExams,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Average Score',
      value: avgScore.toFixed(1),
      icon: iconStar,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Latest Exam',
      value: lastResult ? `${lastResult.score.toFixed(1)}` : '--',
      sub: lastResult?.examTitle ?? 'No exams yet',
      icon: iconClipboard,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Passing Streak',
      value: streak,
      icon: iconFire,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  // Score trend line chart data
  const trendChartData = buildTrendChart(dashboard, trendPeriod);

  // Radar chart data (top 8 topics)
  const radarData = buildRadarChart(strengths);

  // Time-on-task bar chart
  const timeChartData = buildTimeChart(timeData);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your learning progress and analytics overview.
        </p>
      </div>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} padding="md" className="hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.bg} ${card.color}`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500 truncate">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                {card.sub && (
                  <p className="text-xs text-slate-400 truncate">{card.sub}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Row 2: Score Trend + Strengths Radar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Line chart — score trend */}
        <Card padding="md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Score Trend</h3>
            <div className="flex gap-1">
              {(['30d', '60d', '90d'] as TrendPeriod[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTrendPeriod(p)}
                  className={`min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    trendPeriod === p
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
              <span className="text-slate-500">
                Avg: <span className="font-semibold text-slate-900">{currentTrend.avgScore.toFixed(1)}</span>
              </span>
              <span className="text-slate-500">
                Exams: <span className="font-semibold text-slate-900">{currentTrend.examCount}</span>
              </span>
              {prevTrend && prevTrend.avgScore > 0 && (
                <TrendBadge current={currentTrend.avgScore} previous={prevTrend.avgScore} />
              )}
            </div>
          )}
        </Card>

        {/* Radar chart — strengths/weaknesses */}
        <Card padding="md">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Strengths & Weaknesses
          </h3>
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

      {/* Row 3: Time-on-Task + Recent History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar chart — time-on-task */}
        <Card padding="md">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Time per Topic
          </h3>
          <div className="h-56">
            {timeChartData ? (
              <Bar data={timeChartData} options={barChartOptions} />
            ) : (
              <EmptyChart message="No time data available yet" />
            )}
          </div>
          {timeData && (
            <p className="mt-3 text-sm text-slate-500">
              Overall average: <span className="font-semibold text-slate-900">{timeData.overallAvgTimeSec}s</span> per question
            </p>
          )}
        </Card>

        {/* Recent Exam History */}
        <Card padding="none">
          <div className="flex items-center justify-between px-6 pb-3 pt-5">
            <h3 className="text-lg font-semibold text-slate-900">Recent Exams</h3>
            <Link
              to="/student/exams"
              className="min-h-[44px] inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              View all
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
                      <Link
                        to={`/student/attempts/${r.id}/result`}
                        className="font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        {r.examTitle}
                      </Link>
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
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
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
      <svg className="mx-auto h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
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

function buildRadarChart(strengths: StrengthItem[]) {
  if (strengths.length === 0) return null;

  const top = strengths.slice(0, 8);
  return {
    labels: top.map((s) => truncateLabel(s.topicName, 14)),
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

function buildTimeChart(timeData: TimeAnalysisData | null) {
  if (!timeData || timeData.perTopic.length === 0) return null;

  const topics = timeData.perTopic.slice(0, 10);
  return {
    labels: topics.map((t) => truncateLabel(t.topicName, 12)),
    datasets: [
      {
        label: 'Avg time (s)',
        data: topics.map((t) => t.avgTimeSec),
        backgroundColor: topics.map((t) =>
          t.avgTimeSec > 60 ? 'rgba(239, 68, 68, 0.7)' : t.avgTimeSec > 30 ? 'rgba(245, 158, 11, 0.7)' : 'rgba(16, 185, 129, 0.7)',
        ),
        borderRadius: 6,
        maxBarThickness: 36,
      },
    ],
  };
}

function truncateLabel(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + '...' : str;
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

const radarChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      cornerRadius: 8,
    },
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

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 10 }, color: '#94a3b8' },
    },
    y: {
      beginAtZero: true,
      ticks: { font: { size: 11 }, color: '#94a3b8' },
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
