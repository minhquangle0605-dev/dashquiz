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
import type { ExamReportData, ReportAttempt } from '@/types/exam';

type Tab = 'grades' | 'responses' | 'statistics' | 'manual';

const TABS: { key: Tab; label: string }[] = [
  { key: 'grades', label: 'Grades' },
  { key: 'responses', label: 'Responses' },
  { key: 'statistics', label: 'Statistics' },
  { key: 'manual', label: 'Manual grading' },
];

const STAT_FLAG_LABELS: Record<string, string> = {
  insufficient_data: 'Insufficient data',
  too_easy: 'Too easy',
  too_hard: 'Too hard',
  low_discrimination: 'Low discrimination',
};

function studentName(a: ReportAttempt): string {
  return a.student.name || a.student.username;
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
  const [tab, setTab] = useState<Tab>('grades');

  const reportKey = ['exam-report', examId] as const;
  const { data: report, isLoading, isError, error } = useQuery({
    queryKey: reportKey,
    queryFn: () => getExamReport(examId),
    enabled: Number.isFinite(examId),
  });

  const deleteMutation = useMutation({
    mutationFn: (attemptId: number) => deleteExamAttempt(examId, attemptId),
    onSuccess: () => {
      toast.success('Attempt deleted');
      void qc.invalidateQueries({ queryKey: reportKey });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete attempt';
      toast.error(msg);
    },
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
        <Button variant="outline" onClick={() => downloadCsv(report)}>
          Download CSV (grades)
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryStat label="Attempts" value={report.summary.totalAttempts} />
        <SummaryStat label="Avg. score" value={report.summary.avgScore ?? '—'} />
        <SummaryStat label="Median" value={report.summary.medianScore ?? '—'} />
        <SummaryStat label="Highest" value={report.summary.maxScoreAchieved ?? '—'} />
        <SummaryStat
          label="Pass rate"
          value={report.summary.passRate != null ? `${report.summary.passRate}%` : '—'}
        />
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

      {tab === 'grades' && (
        <GradesTab
          report={report}
          onDelete={(attemptId) => {
            if (window.confirm('Delete this attempt? This action cannot be undone.')) {
              deleteMutation.mutate(attemptId);
            }
          }}
          deleting={deleteMutation.isPending}
        />
      )}
      {tab === 'responses' && <ResponsesTab report={report} />}
      {tab === 'statistics' && <StatisticsTab report={report} />}
      {tab === 'manual' && <ManualTab report={report} examId={examId} reportKey={reportKey} />}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <p className="text-xl font-bold text-slate-800">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

/* ── Grades tab ──────────────────────────────────────── */

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
  const maxBucket = Math.max(1, ...report.distribution.map((b) => b.count));

  return (
    <div className="space-y-6">
      {/* Distribution */}
      <Card padding="lg">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Score distribution (out of 10)</h3>
        <div className="flex items-end gap-1.5" style={{ height: 120 }}>
          {report.distribution.map((b) => (
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
                      {a.isAutoSubmitted && (
                        <Badge variant="warning" className="ml-2">Auto</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">
                      {a.totalScore} / {report.exam.maxScore}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {a.timeSpentSec != null ? formatDuration(a.timeSpentSec) : '—'}
                    </td>
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
    </div>
  );
}

/* ── Responses tab ───────────────────────────────────── */

function ResponsesTab({ report }: { report: ExamReportData }) {
  const [attemptId, setAttemptId] = useState<number | null>(
    report.attempts[0]?.attemptId ?? null,
  );
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

/* ── Statistics tab ──────────────────────────────────── */

function StatisticsTab({ report }: { report: ExamReportData }) {
  const questionsById = useMemo(
    () => new Map(report.questions.map((q) => [q.questionId, q])),
    [report.questions],
  );

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Question</th>
              <th className="px-4 py-3 text-right">Correct rate</th>
              <th className="px-4 py-3 text-right">Discrimination</th>
              <th className="px-4 py-3">Warnings</th>
            </tr>
          </thead>
          <tbody>
            {report.statistics.map((s, i) => {
              const q = questionsById.get(s.questionId);
              return (
                <tr key={s.questionId} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="max-w-md truncate px-4 py-3 text-slate-700">
                    {q ? q.content.replace(/\$/g, '') : `#${s.questionId}`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.facility != null ? `${Math.round(s.facility * 100)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.discrimination != null ? s.discrimination.toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.flags.length === 0 ? (
                        <span className="text-xs text-emerald-600">OK</span>
                      ) : (
                        s.flags.map((f) => (
                          <span
                            key={f}
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
                          >
                            {STAT_FLAG_LABELS[f] ?? f}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Manual grading tab ──────────────────────────────── */

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
