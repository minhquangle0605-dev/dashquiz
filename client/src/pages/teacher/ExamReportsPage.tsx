import { Fragment, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { MathText } from '@/components/shared/MathText';
import { formatDuration, formatDate } from '@/utils/format';
import {
  getExamReport,
  gradeExamAnswer,
  deleteExamAttempt,
} from '@/services/examReport.api';
import {
  getExamAnalyticsSummary,
  getExamAnalyticsQuestions,
  getExamAnalyticsStudents,
  recalculateExamAnalytics,
} from '@/services/examAnalytics.api';
import { getQuestionQuality, setQuestionReview } from '@/services/questionQuality.api';
import {
  exportReport,
  getExportHistory,
  getReportDownloadUrl,
  type ExportFormat,
  type ExportReportType,
} from '@/services/reportExport.api';
import type { ReviewStatus } from '@/types/exam';
import type {
  ExamReportData,
  ReportAttempt,
  ExamAnalyticsSummary,
  ExamAnalyticsQuestion,
} from '@/types/exam';

/* ── Tab navigation (PDF §6) ─────────────────────────── */

type MainTab = 'overview' | 'questions' | 'students' | 'exports';

const TABS: { key: MainTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'questions', label: 'Questions' },
  { key: 'students', label: 'Students' },
  { key: 'exports', label: 'Exports' },
];

/* ── Display maps for quality / difficulty flags ─────── */

const QUALITY_BADGE: Record<string, { label: string; cls: string }> = {
  good: { label: 'Good', cls: 'bg-emerald-100 text-emerald-700' },
  ok: { label: 'Acceptable', cls: 'bg-slate-100 text-slate-600' },
  too_easy: { label: 'Too easy', cls: 'bg-sky-100 text-sky-700' },
  too_hard: { label: 'Too hard', cls: 'bg-orange-100 text-orange-700' },
  needs_review: { label: 'Needs review', cls: 'bg-amber-100 text-amber-700' },
  insufficient_data: { label: 'Insufficient data', cls: 'bg-slate-100 text-slate-400' },
};

const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  high: { label: 'Needs support', cls: 'bg-red-100 text-red-700' },
  medium: { label: 'At risk', cls: 'bg-amber-100 text-amber-700' },
  low: { label: 'Watch', cls: 'bg-slate-100 text-slate-600' },
  none: { label: 'On track', cls: 'bg-emerald-100 text-emerald-700' },
};

const DIFFICULTY_LABEL: Record<string, string> = {
  very_easy: 'Very easy',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  very_hard: 'Very hard',
  unknown: '—',
};

const RECOMMENDATION: Record<string, string> = {
  too_easy: 'Almost everyone answered correctly — consider raising the difficulty or rotating it out.',
  too_hard: 'Very few answered correctly — review the wording or reteach this topic.',
  needs_review: 'This item does not separate strong from weak students well — review it.',
  good: 'This item performs well — keep it.',
  ok: 'Acceptable item.',
  insufficient_data: 'Not enough attempts yet to assess this item.',
};

function studentName(a: ReportAttempt): string {
  return a.student.name || a.student.username;
}

function fmtTime(sec: number | null | undefined): string {
  return sec != null ? formatDuration(sec) : '—';
}

function downloadCsv(report: ExamReportData) {
  const header = ['Student', 'Student code', 'Score', 'Max', 'Time (seconds)', 'Submitted at', 'Status'];
  const rows = report.attempts.map((a) => [
    studentName(a),
    a.student.studentCode ?? '',
    String(a.totalScore),
    String(report.exam.maxScore),
    a.timeSpentSec != null ? String(a.timeSpentSec) : '',
    a.submittedAt ?? '',
    a.status,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `grades-exam-${report.exam.id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ExamReportsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const examId = Number(id);
  const qc = useQueryClient();
  const [tab, setTab] = useState<MainTab>('overview');

  const reportKey = ['exam-report', examId] as const;
  const { data: report, isLoading, isError, error } = useQuery({
    queryKey: reportKey,
    queryFn: () => getExamReport(examId),
    enabled: Number.isFinite(examId),
  });

  // Analytics summary drives the page header KPIs + Overview; fetched on mount so
  // it computes the snapshot once (other tabs then read the READY snapshot).
  const summaryKey = ['exam-analytics-summary', examId] as const;
  const { data: analytics } = useQuery({
    queryKey: summaryKey,
    queryFn: () => getExamAnalyticsSummary(examId),
    enabled: Number.isFinite(examId),
  });

  const deleteMutation = useMutation({
    mutationFn: (attemptId: number) => deleteExamAttempt(examId, attemptId),
    onSuccess: () => {
      toast.success('Attempt deleted');
      void qc.invalidateQueries({ queryKey: reportKey });
      void qc.invalidateQueries({ queryKey: ['exam-analytics', examId] });
      void qc.invalidateQueries({ queryKey: summaryKey });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete attempt';
      toast.error(msg);
    },
  });

  const recalcMutation = useMutation({
    mutationFn: () => recalculateExamAnalytics(examId),
    onSuccess: () => {
      toast.success('Analytics recalculated');
      void qc.invalidateQueries({ queryKey: summaryKey });
      void qc.invalidateQueries({ queryKey: ['exam-analytics', examId] });
    },
    onError: () => toast.error('Failed to recalculate analytics'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="mx-auto mt-16 max-w-lg">
        <Card padding="lg">
          <p className="text-center text-sm text-red-600">
            {error instanceof Error ? error.message : 'Failed to load report'}
          </p>
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => navigate('/teacher/exams')}>
              Back to exam list
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate('/teacher/exams')}
            className="mb-1 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            ← Exam list
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Report: {report.exam.title}</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => recalcMutation.mutate()}
          disabled={recalcMutation.isPending}
        >
          {recalcMutation.isPending ? 'Recalculating…' : 'Recalculate analytics'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab analytics={analytics} />}
      {tab === 'questions' && <QuestionsTab examId={examId} />}
      {tab === 'students' && (
        <StudentsTab
          report={report}
          examId={examId}
          reportKey={reportKey}
          onDelete={(attemptId) => {
            if (window.confirm('Delete this attempt? This action cannot be undone.')) {
              deleteMutation.mutate(attemptId);
            }
          }}
          deleting={deleteMutation.isPending}
        />
      )}
      {tab === 'exports' && <ExportsTab report={report} examId={examId} />}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center" title={hint}>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

/* ── Overview tab (PDF §6) ───────────────────────────── */

function OverviewTab({ analytics }: { analytics?: ExamAnalyticsSummary }) {
  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const s = analytics.summary;
  const dist = analytics.scoreDistribution?.distribution ?? [];
  const timeline = analytics.scoreDistribution?.timeline ?? [];
  const maxBucket = Math.max(1, ...dist.map((b) => b.count));
  const maxDay = Math.max(1, ...timeline.map((b) => b.count));

  if (!s || s.totalAttempts === 0) {
    return (
      <Card padding="lg">
        <p className="text-center text-slate-400">No submitted attempts yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Attempts" value={s.totalAttempts} />
        <SummaryStat
          label="Completion rate"
          value={s.completionRate != null ? `${s.completionRate}%` : '—'}
          hint="Submitted attempts ÷ assigned students"
        />
        <SummaryStat label="Average score" value={s.avgScore ?? '—'} hint={`Out of ${s.maxScore}`} />
        <SummaryStat label="Median" value={s.medianScore ?? '—'} />
        <SummaryStat
          label="Pass rate"
          value={s.passRate != null ? `${s.passRate}%` : '—'}
          hint={s.passingScore != null ? `Passing ≥ ${s.passingScore}` : 'No passing score set'}
        />
        <SummaryStat label="Highest" value={s.maxScoreAchieved ?? '—'} />
        <SummaryStat label="Lowest" value={s.minScore ?? '—'} />
        <SummaryStat label="Avg. time" value={fmtTime(s.avgTimeSec)} />
      </div>

      <Card padding="lg">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Score distribution (out of 10)</h3>
        <div className="flex items-end gap-1.5" style={{ height: 120 }}>
          {dist.map((b) => (
            <div key={b.bucket} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] tabular-nums text-slate-500">{b.count || ''}</span>
              <div
                className="w-full rounded-t bg-indigo-500"
                style={{ height: `${(b.count / maxBucket) * 90}px` }}
                title={`${b.bucket}: ${b.count}`}
              />
              <span className="text-[10px] text-slate-400">{b.bucket}</span>
            </div>
          ))}
        </div>
      </Card>

      {timeline.length > 0 && (
        <Card padding="lg">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Submission timeline</h3>
          <div className="flex items-end gap-1.5" style={{ height: 100 }}>
            {timeline.map((b) => (
              <div key={b.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[11px] tabular-nums text-slate-500">{b.count || ''}</span>
                <div
                  className="w-full rounded-t bg-emerald-500"
                  style={{ height: `${(b.count / maxDay) * 70}px` }}
                  title={`${b.date}: ${b.count}`}
                />
                <span className="text-[10px] text-slate-400">{b.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Questions tab — item analysis + detail drawer (PDF §6/§7) ── */

type QSort = 'order' | 'correctRate' | 'skippedRate' | 'avgTime' | 'discrimination';

function QuestionsTab({ examId }: { examId: number }) {
  const { data: questions, isLoading } = useQuery({
    queryKey: ['exam-analytics', examId, 'questions'],
    queryFn: () => getExamAnalyticsQuestions(examId),
    enabled: Number.isFinite(examId),
  });

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<QSort>('order');
  const [asc, setAsc] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const list = (questions ?? []).filter((q) => {
      if (!search.trim()) return true;
      const needle = search.toLowerCase();
      return q.content.toLowerCase().includes(needle);
    });
    const dir = asc ? 1 : -1;
    const val = (q: ExamAnalyticsQuestion): number => {
      switch (sort) {
        case 'correctRate': return q.correctRate ?? -1;
        case 'skippedRate': return q.skippedRate ?? -1;
        case 'avgTime': return q.avgTimeSec ?? -1;
        case 'discrimination': return q.discrimination ?? -2;
        default: return q.orderIndex;
      }
    };
    return [...list].sort((a, b) => (val(a) - val(b)) * dir);
  }, [questions, search, sort, asc]);

  const open = questions?.find((q) => q.questionId === openId) ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return <Card padding="lg"><p className="text-center text-slate-400">No questions to analyse.</p></Card>;
  }

  const toggleSort = (key: QSort) => {
    if (sort === key) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(key === 'order');
    }
  };

  const SortTh = ({ k, label, className }: { k: QSort; label: string; className?: string }) => (
    <th className={`px-4 py-3 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-slate-700"
      >
        {label}
        {sort === k && <span className="text-[10px]">{asc ? '▲' : '▼'}</span>}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search question text…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-10 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm"
      />

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Question</th>
                <SortTh k="correctRate" label="Correct" className="text-right" />
                <SortTh k="skippedRate" label="Skipped" className="text-right" />
                <SortTh k="avgTime" label="Avg time" className="text-right" />
                <SortTh k="discrimination" label="Discrim." className="text-right" />
                <th className="px-4 py-3">Quality</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const quality = QUALITY_BADGE[q.qualityFlag] ?? QUALITY_BADGE.insufficient_data;
                return (
                  <tr
                    key={q.questionId}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => setOpenId(q.questionId)}
                  >
                    <td className="px-4 py-3 text-slate-500">{q.orderIndex + 1}</td>
                    <td className="max-w-md truncate px-4 py-3 text-slate-700">
                      {q.content.replace(/\$/g, '')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {q.correctRate != null ? `${q.correctRate}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {q.skippedRate != null ? `${q.skippedRate}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {fmtTime(q.avgTimeSec)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {q.discrimination != null ? q.discrimination.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${quality.cls}`}>
                        {quality.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {open && <QuestionDetailDrawer question={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function QuestionDetailDrawer({
  question,
  onClose,
}: {
  question: ExamAnalyticsQuestion;
  onClose: () => void;
}) {
  const quality = QUALITY_BADGE[question.qualityFlag] ?? QUALITY_BADGE.insufficient_data;
  const maxRate = Math.max(1, ...question.options.map((o) => o.selectedRate));

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <span className="text-sm font-semibold text-slate-700">
            Question {question.orderIndex + 1} · {question.points} pts
          </span>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${quality.cls}`}>
              {quality.label}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
              {DIFFICULTY_LABEL[question.difficultyLabel] ?? question.difficultyLabel}
            </span>
            <span className="text-xs text-slate-400">{question.questionType}</span>
          </div>

          <div className="text-sm text-slate-800">
            <MathText>{question.content}</MathText>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Correct" value={question.correctRate != null ? `${question.correctRate}%` : '—'} />
            <MiniStat label="Skipped" value={question.skippedRate != null ? `${question.skippedRate}%` : '—'} />
            <MiniStat label="Avg time" value={fmtTime(question.avgTimeSec)} />
          </div>

          {question.options.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Option distribution</p>
              <div className="space-y-2">
                {question.options.map((o) => (
                  <div key={o.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={o.isCorrect ? 'font-semibold text-emerald-700' : 'text-slate-700'}>
                        {o.label}. {o.content.replace(/\$/g, '')}
                        {o.isCorrect && ' ✓'}
                      </span>
                      <span className="tabular-nums text-slate-500">
                        {o.selectedCount} ({o.selectedRate}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded bg-slate-100">
                      <div
                        className={`h-2 rounded ${
                          o.isCorrect
                            ? 'bg-emerald-500'
                            : o.distractorFlag === 'too_attractive'
                              ? 'bg-rose-500'
                              : 'bg-slate-400'
                        }`}
                        style={{ width: `${(o.selectedRate / maxRate) * 100}%` }}
                      />
                    </div>
                    {o.distractorFlag && (
                      <p className="mt-0.5 text-[11px] text-amber-600">
                        {o.distractorFlag === 'never_selected'
                          ? 'Never selected — weak distractor'
                          : 'Selected more than the correct answer — misleading distractor'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {question.explanation && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">Explanation</p>
              <div className="mt-1 text-sm text-slate-700">
                <MathText>{question.explanation}</MathText>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
            <p className="text-xs font-semibold text-indigo-600">Recommendation</p>
            <p className="mt-1 text-sm text-indigo-900">
              {RECOMMENDATION[question.qualityFlag] ?? RECOMMENDATION.ok}
            </p>
          </div>

          <QuestionReviewSection questionId={question.questionId} />
        </div>
      </div>
    </div>
  );
}

const REVIEW_STATUS_OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: 'needs_review', label: 'Needs review' },
  { value: 'needs_revision', label: 'Needs revision' },
  { value: 'approved', label: 'Approved' },
  { value: 'good', label: 'Good' },
  { value: 'rejected', label: 'Rejected' },
];

function QuestionReviewSection({ questionId }: { questionId: number }) {
  const qc = useQueryClient();
  const qualityKey = ['question-quality', questionId] as const;
  const { data: quality, isLoading } = useQuery({
    queryKey: qualityKey,
    queryFn: () => getQuestionQuality(questionId),
  });

  const [status, setStatus] = useState<ReviewStatus>('needs_review');
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);

  const mutation = useMutation({
    mutationFn: () => setQuestionReview(questionId, { status, comment: comment.trim() || null }),
    onSuccess: () => {
      toast.success('Review saved');
      setEditing(false);
      void qc.invalidateQueries({ queryKey: qualityKey });
    },
    onError: () => toast.error('Failed to save review'),
  });

  const review = quality?.review ?? null;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-slate-500">Review status</p>
        {quality && (
          <span className="text-[11px] text-slate-400">
            Used in {quality.usage.examCount} exam{quality.usage.examCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="mt-2 text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant={
                review?.status === 'approved' || review?.status === 'good'
                  ? 'success'
                  : review?.status === 'rejected' || review?.status === 'needs_revision'
                    ? 'danger'
                    : 'warning'
              }
            >
              {review ? (REVIEW_STATUS_OPTIONS.find((o) => o.value === review.status)?.label ?? review.status) : 'Not reviewed'}
            </Badge>
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setStatus((review?.status as ReviewStatus) ?? 'needs_review');
                  setComment(review?.comment ?? '');
                  setEditing(true);
                }}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                {review ? 'Update' : 'Add review'}
              </button>
            )}
          </div>

          {review?.comment && !editing && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{review.comment}</p>
          )}

          {editing && (
            <div className="mt-2 space-y-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReviewStatus)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                {REVIEW_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Reviewer comment (optional)"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                This is a recommendation to help curate the question bank — not an automatic action.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <p className="text-sm font-bold text-slate-800">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

/* ── Students tab — grades / responses / manual grading ── */

type StudentSubTab = 'performance' | 'grades' | 'responses' | 'manual';

function StudentsTab({
  report,
  examId,
  reportKey,
  onDelete,
  deleting,
}: {
  report: ExamReportData;
  examId: number;
  reportKey: readonly [string, number];
  onDelete: (attemptId: number) => void;
  deleting: boolean;
}) {
  const [sub, setSub] = useState<StudentSubTab>('performance');
  const subTabs: { key: StudentSubTab; label: string }[] = [
    { key: 'performance', label: 'Performance' },
    { key: 'grades', label: 'Grades' },
    { key: 'responses', label: 'Responses' },
    { key: 'manual', label: 'Manual grading' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {subTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSub(t.key)}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              sub === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'performance' && <StudentPerformanceTab examId={examId} />}
      {sub === 'grades' && <GradesTab report={report} onDelete={onDelete} deleting={deleting} />}
      {sub === 'responses' && <ResponsesTab report={report} />}
      {sub === 'manual' && <ManualTab report={report} examId={examId} reportKey={reportKey} />}
    </div>
  );
}

/* ── Student performance sub-tab — ranking + risk (PDF §6) ── */

type RiskFilter = 'all' | 'high' | 'medium' | 'low' | 'none';

function StudentPerformanceTab({ examId }: { examId: number }) {
  const { data: students, isLoading } = useQuery({
    queryKey: ['exam-analytics', examId, 'students'],
    queryFn: () => getExamAnalyticsStudents(examId),
    enabled: Number.isFinite(examId),
  });

  const [risk, setRisk] = useState<RiskFilter>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const rows = useMemo(() => {
    return (students ?? []).filter((s) => {
      if (risk !== 'all' && s.riskLevel !== risk) return false;
      if (search.trim()) {
        const needle = search.toLowerCase();
        const name = (s.student.name || s.student.username).toLowerCase();
        if (!name.includes(needle) && !(s.student.studentCode ?? '').toLowerCase().includes(needle)) {
          return false;
        }
      }
      return true;
    });
  }, [students, risk, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!students || students.length === 0) {
    return <Card padding="lg"><p className="text-center text-slate-400">No submitted attempts yet.</p></Card>;
  }

  const riskCounts = students.reduce<Record<string, number>>((acc, s) => {
    acc[s.riskLevel] = (acc[s.riskLevel] ?? 0) + 1;
    return acc;
  }, {});

  const FILTERS: { key: RiskFilter; label: string }[] = [
    { key: 'all', label: `All (${students.length})` },
    { key: 'high', label: `Needs support (${riskCounts.high ?? 0})` },
    { key: 'medium', label: `At risk (${riskCounts.medium ?? 0})` },
    { key: 'low', label: `Watch (${riskCounts.low ?? 0})` },
    { key: 'none', label: `On track (${riskCounts.none ?? 0})` },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setRisk(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              risk === f.key
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          type="search"
          placeholder="Search student…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto h-9 w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm"
        />
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No students match this filter
                  </td>
                </tr>
              )}
              {rows.map((s) => {
                const badge = RISK_BADGE[s.riskLevel] ?? RISK_BADGE.none;
                const expanded = open === s.attemptId;
                return (
                  <Fragment key={s.attemptId}>
                    <tr
                      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                      onClick={() => setOpen(expanded ? null : s.attemptId)}
                    >
                      <td className="px-4 py-3 text-slate-500">{s.rank}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {s.student.name || s.student.username}
                        {s.student.studentCode && (
                          <span className="ml-1 text-xs text-slate-400">({s.student.studentCode})</span>
                        )}
                        {s.isAutoSubmitted && <Badge variant="warning" className="ml-2">Auto</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">
                        {s.score}
                        {s.passed === false && <span className="ml-1 text-xs text-red-500">Fail</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{fmtTime(s.timeSpentSec)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                    {expanded && s.recommendations.length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-3">
                          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                            Recommendations
                          </p>
                          <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-700">
                            {s.recommendations.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Exports tab — PDF / Excel bundles + history (PDF §8) ── */

const EXPORT_TYPES: { type: ExportReportType; label: string; desc: string }[] = [
  { type: 'exam_summary', label: 'Exam summary', desc: 'KPIs: averages, pass & completion rates, time.' },
  { type: 'question_analysis', label: 'Question analysis', desc: 'Per-question correct rate, discrimination, quality.' },
  { type: 'student_results', label: 'Student results', desc: 'Ranking, score and risk level.' },
];

const REPORT_TYPE_LABEL: Record<string, string> = {
  exam_summary: 'Exam summary',
  question_analysis: 'Question analysis',
  student_results: 'Student results',
  exam_results: 'Exam results',
  class_results: 'Class results',
};

function ExportsTab({ report, examId }: { report: ExamReportData; examId: number }) {
  const qc = useQueryClient();
  const historyKey = ['report-export-history'] as const;
  const { data: history } = useQuery({ queryKey: historyKey, queryFn: getExportHistory });
  const [busy, setBusy] = useState<string | null>(null);

  const runExport = async (reportType: ExportReportType, format: ExportFormat) => {
    setBusy(`${reportType}-${format}`);
    try {
      const result = await exportReport({ reportType, format, examId });
      window.open(result.downloadUrl, '_blank', 'noopener');
      toast.success('Report generated');
      void qc.invalidateQueries({ queryKey: historyKey });
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setBusy(null);
    }
  };

  const openDownload = async (id: number) => {
    try {
      const { downloadUrl } = await getReportDownloadUrl(id);
      window.open(downloadUrl, '_blank', 'noopener');
    } catch {
      toast.error('Failed to get download link');
    }
  };

  return (
    <div className="space-y-4">
      <Card padding="lg">
        <h3 className="text-sm font-semibold text-slate-700">Export reports</h3>
        <p className="mt-1 text-sm text-slate-500">
          Generate a PDF or Excel report for this exam. Files are stored and can be re-downloaded below.
        </p>
        <div className="mt-4 space-y-3">
          {EXPORT_TYPES.map((t) => (
            <div
              key={t.type}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{t.label}</p>
                <p className="text-xs text-slate-500">{t.desc}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === `${t.type}-pdf`}
                  onClick={() => runExport(t.type, 'pdf')}
                >
                  {busy === `${t.type}-pdf` ? '…' : 'PDF'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === `${t.type}-excel`}
                  onClick={() => runExport(t.type, 'excel')}
                >
                  {busy === `${t.type}-excel` ? '…' : 'Excel'}
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Grades (raw CSV)</p>
              <p className="text-xs text-slate-500">Quick client-side export of the grades table.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => downloadCsv(report)}>
              CSV
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
          Export history
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(!history || history.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No exports yet
                  </td>
                </tr>
              )}
              {history?.map((h) => (
                <tr key={h.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-700">
                    {REPORT_TYPE_LABEL[h.reportType] ?? h.reportType}
                  </td>
                  <td className="px-4 py-3 uppercase text-slate-500">{h.format}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(h.createdAt, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openDownload(h.id)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Grades sub-tab (unchanged behaviour) ────────────── */

function GradesTab({
  report,
  onDelete,
  deleting,
}: {
  report: ExamReportData;
  onDelete: (attemptId: number) => void;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Submitted at</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {report.attempts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No attempts yet
                </td>
              </tr>
            )}
            {report.attempts.map((a) => (
              <Fragment key={a.attemptId}>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === a.attemptId ? null : a.attemptId)}
                      className="text-left font-medium text-slate-800 hover:text-indigo-600"
                    >
                      {studentName(a)}
                      {a.student.studentCode && (
                        <span className="ml-1 text-xs text-slate-400">({a.student.studentCode})</span>
                      )}
                    </button>
                    {a.isAutoSubmitted && <Badge variant="warning" className="ml-2">Auto</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">
                    {a.totalScore} / {report.exam.maxScore}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{fmtTime(a.timeSpentSec)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {a.submittedAt
                      ? formatDate(a.submittedAt, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => onDelete(a.attemptId)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {expanded === a.attemptId && (
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {a.answers.map((ans, i) => (
                          <span
                            key={ans.questionId}
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              ans.score >= ans.max && ans.max > 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : ans.score > 0
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                            }`}
                            title={`Question ${i + 1}`}
                          >
                            Q{i + 1}: {ans.score}/{ans.max}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Responses sub-tab (unchanged behaviour) ─────────── */

function ResponsesTab({ report }: { report: ExamReportData }) {
  const [attemptId, setAttemptId] = useState<number | null>(report.attempts[0]?.attemptId ?? null);
  const attempt = report.attempts.find((a) => a.attemptId === attemptId) ?? null;
  const questionsById = useMemo(
    () => new Map(report.questions.map((q) => [q.questionId, q])),
    [report.questions],
  );

  if (report.attempts.length === 0) {
    return <Card padding="lg"><p className="text-center text-slate-400">No attempts yet</p></Card>;
  }

  return (
    <div className="space-y-4">
      <select
        className="h-11 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm"
        value={attemptId ?? ''}
        onChange={(e) => setAttemptId(Number(e.target.value))}
      >
        {report.attempts.map((a) => (
          <option key={a.attemptId} value={a.attemptId}>
            {studentName(a)} — {a.totalScore}/{report.exam.maxScore}
          </option>
        ))}
      </select>

      {attempt && (
        <div className="space-y-3">
          {attempt.answers.map((ans, i) => {
            const q = questionsById.get(ans.questionId);
            const correct = ans.score >= ans.max && ans.max > 0;
            return (
              <Card key={ans.questionId} padding="lg">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Question {i + 1}</span>
                  <Badge variant={correct ? 'success' : ans.score > 0 ? 'warning' : 'danger'}>
                    {ans.score}/{ans.max}
                  </Badge>
                </div>
                {q && (
                  <div className="mb-3 text-sm text-slate-800">
                    <MathText>{q.content}</MathText>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500">Student's answer</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                      {ans.response || <span className="italic text-slate-400">(no answer)</span>}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-600">Correct answer</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-800">
                      {q?.correctText || '—'}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Manual grading sub-tab (unchanged behaviour) ────── */

function ManualTab({
  report,
  examId,
  reportKey,
}: {
  report: ExamReportData;
  examId: number;
  reportKey: readonly [string, number];
}) {
  const manualQuestions = report.questions.filter((q) => q.questionType === 'SHORT_ANSWER');

  if (manualQuestions.length === 0) {
    return (
      <Card padding="lg">
        <p className="text-center text-slate-400">
          This exam has no short-answer (SHORT_ANSWER) questions that need manual grading.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {manualQuestions.map((q, qi) => (
        <Card key={q.questionId} padding="lg">
          <div className="mb-1 text-sm font-semibold text-slate-700">
            Short-answer question {qi + 1} · max {q.points} points
          </div>
          <div className="mb-3 text-sm text-slate-800">
            <MathText>{q.content}</MathText>
          </div>
          <p className="mb-3 text-xs text-emerald-700">Sample answer: {q.correctText || '—'}</p>
          <div className="space-y-3">
            {report.attempts.map((a) => {
              const ans = a.answers.find((x) => x.questionId === q.questionId);
              if (!ans || ans.answerId === null) return null;
              return (
                <ManualGradeRow
                  key={a.attemptId}
                  examId={examId}
                  reportKey={reportKey}
                  attemptId={a.attemptId}
                  answerId={ans.answerId}
                  studentName={studentName(a)}
                  response={ans.response}
                  max={q.points}
                  currentScore={ans.manualScore ?? ans.score}
                  graded={ans.graded}
                  feedback={ans.manualFeedback}
                />
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ManualGradeRow({
  examId,
  reportKey,
  attemptId,
  answerId,
  studentName: name,
  response,
  max,
  currentScore,
  graded,
  feedback,
}: {
  examId: number;
  reportKey: readonly [string, number];
  attemptId: number;
  answerId: number;
  studentName: string;
  response: string;
  max: number;
  currentScore: number;
  graded: boolean;
  feedback: string | null;
}) {
  const qc = useQueryClient();
  const [score, setScore] = useState<string>(String(currentScore));
  const [fb, setFb] = useState<string>(feedback ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      gradeExamAnswer(examId, attemptId, answerId, {
        score: Number(score),
        feedback: fb.trim() ? fb.trim() : null,
      }),
    onSuccess: () => {
      toast.success('Score saved');
      void qc.invalidateQueries({ queryKey: reportKey });
      void qc.invalidateQueries({ queryKey: ['exam-analytics', examId] });
      void qc.invalidateQueries({ queryKey: ['exam-analytics-summary', examId] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to save score';
      toast.error(msg);
    },
  });

  const numeric = Number(score);
  const invalid = Number.isNaN(numeric) || numeric < 0 || numeric > max;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800">{name}</span>
        {graded && <Badge variant="success">Graded</Badge>}
      </div>
      <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-sm text-slate-700">
        {response || <span className="italic text-slate-400">(no answer)</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          max={max}
          step="0.25"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <span className="text-xs text-slate-500">/ {max}</span>
        <input
          type="text"
          placeholder="Feedback (optional)"
          value={fb}
          onChange={(e) => setFb(e.target.value)}
          className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <Button
          size="sm"
          variant="primary"
          disabled={invalid || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Save
        </Button>
      </div>
      {invalid && <p className="mt-1 text-xs text-red-500">Score must be between 0 and {max}</p>}
    </div>
  );
}
