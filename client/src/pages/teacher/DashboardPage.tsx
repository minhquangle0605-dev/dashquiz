import { useEffect, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
import {
  getTeacherClasses,
  getTeacherExams,
  getClassDashboard,
  getClassPerformance,
  getExamDistribution,
  getWeakStudents,
  getExamResults,
  exportReport,
  type ClassDashboardData,
  type ClassPerformanceItem,
  type ExamDistributionData,
  type WeakStudentItem,
  type ExamResultItem,
} from '@/services/analytics.api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
);

export default function DashboardPage() {
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [exams, setExams] = useState<{ id: number; title: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  const [classDash, setClassDash] = useState<ClassDashboardData | null>(null);
  const [performance, setPerformance] = useState<ClassPerformanceItem[]>([]);
  const [distribution, setDistribution] = useState<ExamDistributionData | null>(null);
  const [weakStudents, setWeakStudents] = useState<WeakStudentItem[]>([]);
  const [results, setResults] = useState<ExamResultItem[]>([]);
  const [resultsMeta, setResultsMeta] = useState<{ total: number; examTitle: string }>({ total: 0, examTitle: '' });

  const [loading, setLoading] = useState(true);
  const [classLoading, setClassLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState<'pdf' | 'excel' | null>(null);

  const [sortField, setSortField] = useState<'name' | 'score' | 'time'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch initial class list
  const fetchInitial = useCallback(async () => {
    try {
      const [classData, examData] = await Promise.allSettled([
        getTeacherClasses(),
        getTeacherExams(),
      ]);

      if (classData.status === 'fulfilled') {
        setClasses(classData.value);
        if (classData.value.length > 0) {
          setSelectedClassId(classData.value[0].id);
        }
      }
      if (examData.status === 'fulfilled') {
        setExams(examData.value);
        if (examData.value.length > 0) {
          setSelectedExamId(examData.value[0].id);
        }
      }
    } catch {
      // remain empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Fetch class-specific data
  const fetchClassData = useCallback(async (classId: number) => {
    setClassLoading(true);
    try {
      const [dashResult, perfResult, weakResult] = await Promise.allSettled([
        getClassDashboard(classId),
        getClassPerformance(classId, 10),
        getWeakStudents(classId),
      ]);

      if (dashResult.status === 'fulfilled') setClassDash(dashResult.value);
      else setClassDash(null);

      if (perfResult.status === 'fulfilled') setPerformance(perfResult.value);
      else setPerformance([]);

      if (weakResult.status === 'fulfilled') setWeakStudents(weakResult.value);
      else setWeakStudents([]);
    } catch {
      // remain at defaults
    } finally {
      setClassLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) fetchClassData(selectedClassId);
  }, [selectedClassId, fetchClassData]);

  // Fetch exam-specific data
  const fetchExamData = useCallback(async (examId: number) => {
    try {
      const [distResult, resResult] = await Promise.allSettled([
        getExamDistribution(examId),
        getExamResults(examId, { page: 1, limit: 20, sort: sortField, order: sortOrder }),
      ]);

      if (distResult.status === 'fulfilled') setDistribution(distResult.value);
      else setDistribution(null);

      if (resResult.status === 'fulfilled') {
        setResults(resResult.value.results);
        setResultsMeta({ total: resResult.value.pagination.total, examTitle: resResult.value.exam.title });
      } else {
        setResults([]);
      }
    } catch {
      // remain at defaults
    }
  }, [sortField, sortOrder]);

  useEffect(() => {
    if (selectedExamId) fetchExamData(selectedExamId);
  }, [selectedExamId, fetchExamData]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!selectedClassId && !selectedExamId) return;
    setExportLoading(format);
    try {
      const body: {
        format: 'pdf' | 'excel';
        reportType: string;
        classId?: number;
        examId?: number;
        title?: string;
      } = {
        format,
        reportType: selectedExamId ? 'exam_results' : 'class_results',
      };
      if (selectedExamId) body.examId = selectedExamId;
      if (selectedClassId) body.classId = selectedClassId;
      body.title = resultsMeta.examTitle || classDash?.class.name || 'Report';

      const result = await exportReport(body);
      window.open(result.downloadUrl, '_blank');
    } catch {
      // silently fail
    } finally {
      setExportLoading(null);
    }
  };

  const handleSort = (field: 'name' | 'score' | 'time') => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

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

  const statTiles = classDash
    ? [
        {
          label: 'Enrolled',
          value: classDash.enrolledCount,
          icon: iconUsers,
          tone: 'info' as const,
          hint: `${classDash.class.name}`,
        },
        {
          label: 'Average Score',
          value: Number(classDash.avgScore.toFixed(1)),
          icon: iconChart,
          tone: 'success' as const,
          decimals: 1,
        },
        {
          label: 'Pass Rate',
          value: `${classDash.passRate}%`,
          icon: iconCheck,
          tone: 'accent' as const,
        },
        {
          label: 'Total Exams',
          value: classDash.examCount,
          icon: iconExam,
          tone: 'warning' as const,
        },
      ]
    : [];

  const quickActions = [
    {
      label: 'Create exam',
      description: 'Build a new assessment',
      to: '/teacher/exams/create',
      icon: iconExam,
      tone: 'brand' as const,
    },
    {
      label: 'Question bank',
      description: 'Manage your library',
      to: '/teacher/questions',
      icon: iconBank,
      tone: 'accent' as const,
    },
    {
      label: 'Classes',
      description: 'Roster & resources',
      to: '/teacher/classes',
      icon: iconUsers,
      tone: 'info' as const,
    },
    {
      label: 'All exams',
      description: 'Browse & monitor',
      to: '/teacher/exams',
      icon: iconChart,
      tone: 'success' as const,
    },
  ];

  const performanceChartData = buildPerformanceChart(performance);
  const distributionChartData = buildDistributionChart(distribution);

  return (
    <div className="space-y-6">
      {/* Greeting hero */}
      <GreetingBanner
        subtitle="Analytics, học sinh cần hỗ trợ và kết quả lớp – trong một màn hình."
        meta={
          classDash
            ? [
                { label: 'Class', value: classDash.class.name, tone: 'brand' },
                { label: 'Avg', value: classDash.avgScore.toFixed(1), tone: 'success' },
                { label: 'Pass rate', value: `${classDash.passRate}%`, tone: 'info' },
              ]
            : undefined
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedClassId ?? ''}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
              className="min-h-[44px] rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm placeholder:text-white/60 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-slate-900"
            >
              {classes.length === 0 && <option value="">No classes</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="border-white/40 bg-white/15 text-white hover:bg-white/25 hover:text-white"
              isLoading={exportLoading === 'pdf'}
              onClick={() => handleExport('pdf')}
            >
              Export PDF
            </Button>
            <Button
              variant="outline"
              className="border-white/40 bg-white/15 text-white hover:bg-white/25 hover:text-white"
              isLoading={exportLoading === 'excel'}
              onClick={() => handleExport('excel')}
            >
              Export Excel
            </Button>
          </div>
        }
      />

      {/* Quick actions */}
      <QuickActionsGrid title="Quick actions" actions={quickActions} />

      {classLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          {/* Stat Tiles */}
          {statTiles.length > 0 && (
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
          )}

          {/* Row 2: Performance + Distribution */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Performance trend */}
            <Card padding="md">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Class Performance</h3>
              <div className="h-56">
                {performanceChartData ? (
                  <Line data={performanceChartData} options={lineChartOptions} />
                ) : (
                  <EmptyChart message="No performance data available" />
                )}
              </div>
            </Card>

            {/* Score distribution */}
            <Card padding="md">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Score Distribution</h3>
                <select
                  value={selectedExamId ?? ''}
                  onChange={(e) => setSelectedExamId(Number(e.target.value))}
                  className="min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  {exams.length === 0 && <option value="">No exams</option>}
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="h-56">
                {distributionChartData ? (
                  <Bar data={distributionChartData} options={barChartOptions} />
                ) : (
                  <EmptyChart message="No distribution data for this exam" />
                )}
              </div>
              {distribution && (
                <div className="mt-3 flex gap-4 text-sm text-slate-500">
                  <span>Avg: <span className="font-semibold text-slate-900">{distribution.avgScore}</span></span>
                  <span>Median: <span className="font-semibold text-slate-900">{distribution.medianScore}</span></span>
                  <span>Attempts: <span className="font-semibold text-slate-900">{distribution.totalAttempts}</span></span>
                </div>
              )}
            </Card>
          </div>

          {/* Row 3: Weak Students + Results Table */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Weak students alert */}
            <Card padding="none" className="lg:col-span-1">
              <div className="px-6 pb-2 pt-5">
                <h3 className="text-lg font-semibold text-slate-900">Students at Risk</h3>
                <p className="mt-1 text-xs text-slate-400">Below passing score for 3+ consecutive exams</p>
              </div>

              {weakStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center pb-8 pt-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                    <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">No students at risk in this class.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {weakStudents.map((ws) => (
                    <div key={ws.student.id} className="flex items-start gap-3 px-6 py-3 hover:bg-red-50/50 transition-colors">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                        <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{ws.student.fullName}</p>
                        <p className="text-xs text-slate-400">@{ws.student.username}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="danger">Avg: {ws.avgScore.toFixed(1)}</Badge>
                          <span className="text-xs text-slate-400">
                            Last {ws.recentScores.length} exams
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Results data table */}
            <Card padding="none" className="lg:col-span-2">
              <div className="flex items-center justify-between px-6 pb-2 pt-5">
                <h3 className="text-lg font-semibold text-slate-900">Exam Results</h3>
                <span className="text-xs text-slate-400">{resultsMeta.total} students</span>
              </div>

              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center pb-8 pt-4 text-center">
                  <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.375" />
                  </svg>
                  <p className="mt-3 text-sm text-slate-500">Select an exam to see results.</p>
                </div>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <SortableHeader field="name" label="Student" current={sortField} order={sortOrder} onSort={handleSort} />
                      <SortableHeader field="score" label="Score" current={sortField} order={sortOrder} onSort={handleSort} />
                      <SortableHeader field="time" label="Time" current={sortField} order={sortOrder} onSort={handleSort} />
                      <TableHeaderCell>Status</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.attemptId} className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{r.studentName}</p>
                            <p className="text-xs text-slate-400">@{r.studentUsername}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${r.passed === false ? 'text-red-600' : r.passed ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {r.score.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-slate-600">
                            {r.timeSpentSec ? `${Math.round(r.timeSpentSec / 60)}m` : '--'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {r.passed === null ? (
                            <Badge variant="neutral">N/A</Badge>
                          ) : r.passed ? (
                            <Badge variant="success">Passed</Badge>
                          ) : (
                            <Badge variant="danger">Failed</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════

function SortableHeader({
  field,
  label,
  current,
  order,
  onSort,
}: {
  field: 'name' | 'score' | 'time';
  label: string;
  current: string;
  order: string;
  onSort: (f: 'name' | 'score' | 'time') => void;
}) {
  const isActive = current === field;
  return (
    <th
      scope="col"
      className="cursor-pointer px-4 py-3 font-semibold text-slate-700 select-none hover:text-indigo-600 transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <svg className={`h-3 w-3 ${order === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3l-7 7h14l-7-7z" />
          </svg>
        )}
      </span>
    </th>
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

function buildPerformanceChart(perf: ClassPerformanceItem[]) {
  if (perf.length === 0) return null;

  return {
    labels: perf.map((p) => p.examTitle.length > 18 ? p.examTitle.slice(0, 16) + '...' : p.examTitle),
    datasets: [
      {
        label: 'Average Score',
        data: perf.map((p) => p.avgScore),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#10b981',
      },
    ],
  };
}

function buildDistributionChart(dist: ExamDistributionData | null) {
  if (!dist || dist.bins.length === 0) return null;

  return {
    labels: dist.bins.map((b) => b.label),
    datasets: [
      {
        label: 'Students',
        data: dist.bins.map((b) => b.count),
        backgroundColor: [
          'rgba(239, 68, 68, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(59, 130, 246, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(79, 70, 229, 0.7)',
        ],
        borderRadius: 6,
        maxBarThickness: 48,
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
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 10 }, color: '#94a3b8', maxRotation: 30 },
    },
    y: {
      min: 0,
      max: 10,
      ticks: { font: { size: 11 }, color: '#94a3b8', stepSize: 2 },
      grid: { color: '#f1f5f9' },
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
      ticks: { font: { size: 11 }, color: '#94a3b8' },
    },
    y: {
      beginAtZero: true,
      ticks: { font: { size: 11 }, color: '#94a3b8', precision: 0 },
      grid: { color: '#f1f5f9' },
    },
  },
} as const;

// ═══════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════

const iconUsers = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const iconChart = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const iconCheck = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const iconExam = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const iconBank = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);
