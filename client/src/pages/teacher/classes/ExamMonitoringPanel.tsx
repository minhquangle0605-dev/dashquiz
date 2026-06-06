import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useExamMonitor } from '@/hooks/useExamMonitor';
import {
  getAttemptEvidence,
  getExamMonitoring,
  getExamSecuritySettings,
  saveProctorReview,
  updateExamSecuritySettings,
} from '@/services/exam.api';
import type {
  AttemptEvidenceData,
  AttemptMonitoringEventType,
  ExamMonitoringData,
  ExamMonitoringStudent,
  ExamSecuritySettings,
  ProctorReviewDecision,
  SecurityRiskLevel,
  TeacherExam,
} from '@/types/exam';
import { formatDate, formatDuration } from '@/utils/format';

const STATUS_CONFIG: Record<
  ExamMonitoringStudent['status'],
  { label: string; variant: BadgeVariant }
> = {
  NOT_STARTED: { label: 'Not Started', variant: 'neutral' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  SUBMITTED: { label: 'Submitted', variant: 'success' },
  GRADED: { label: 'Graded', variant: 'success' },
};

const RISK_CONFIG: Record<ExamMonitoringStudent['riskLevel'], { label: string; variant: BadgeVariant }> = {
  low: { label: 'Normal', variant: 'success' },
  watch: { label: 'Watch', variant: 'info' },
  medium: { label: 'Review', variant: 'warning' },
  high: { label: 'High Risk', variant: 'danger' },
  critical: { label: 'Critical', variant: 'danger' },
};

const EVENT_LABELS: Record<AttemptMonitoringEventType, string> = {
  STARTED: 'Started',
  RESUMED: 'Resumed',
  HEARTBEAT: 'Heartbeat',
  ANSWER_SAVED: 'Answer saved',
  TAB_HIDDEN: 'Tab switch',
  WINDOW_BLUR: 'Lost focus',
  FULLSCREEN_EXITED: 'Fullscreen exited',
  FULLSCREEN_RESTORED: 'Fullscreen restored',
  COPY: 'Copy',
  PASTE: 'Paste',
  CUT: 'Cut',
  CONTEXT_MENU: 'Right-click menu',
  SHORTCUT_BLOCKED: 'Blocked shortcut',
  OFFLINE: 'Disconnected',
  ONLINE: 'Reconnected',
  CAMERA_PERMISSION_MISSING: 'Camera missing',
  DEVICE_CHANGED: 'Device changed',
  SUBMITTED: 'Submitted',
  AUTO_SUBMITTED: 'Auto-submitted',
};

const SECURITY_LEVEL_OPTIONS: Array<{ value: ExamSecuritySettings['securityLevel']; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'LOCKDOWN', label: 'Lockdown-like' },
];

const REVIEW_DECISIONS: Array<{ value: ProctorReviewDecision; label: string }> = [
  { value: 'NO_ACTION', label: 'No Action' },
  { value: 'WATCH', label: 'Watch' },
  { value: 'FLAGGED', label: 'Flagged' },
  { value: 'CLEARED', label: 'Cleared' },
];

const REVIEW_RISK_LEVELS: Array<{ value: SecurityRiskLevel; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'WATCH', label: 'Watch' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const SECURITY_PRESETS: Record<
  ExamSecuritySettings['securityLevel'],
  Partial<ExamSecuritySettings>
> = {
  LOW: {
    requirePreCheck: false,
    requireFullscreen: false,
    blockCopyPaste: false,
    blockRightClick: false,
    blockShortcuts: false,
    requireCamera: false,
    maxDevices: 2,
    allowResume: true,
    warningThreshold: 25,
    autoSubmitThreshold: null,
  },
  MEDIUM: {
    requirePreCheck: true,
    requireFullscreen: true,
    blockCopyPaste: true,
    blockRightClick: true,
    blockShortcuts: true,
    requireCamera: false,
    maxDevices: 1,
    allowResume: true,
    warningThreshold: 15,
    autoSubmitThreshold: 100,
  },
  HIGH: {
    requirePreCheck: true,
    requireFullscreen: true,
    blockCopyPaste: true,
    blockRightClick: true,
    blockShortcuts: true,
    requireCamera: false,
    maxDevices: 1,
    allowResume: true,
    warningThreshold: 15,
    autoSubmitThreshold: 80,
  },
  LOCKDOWN: {
    requirePreCheck: true,
    requireFullscreen: true,
    blockCopyPaste: true,
    blockRightClick: true,
    blockShortcuts: true,
    requireCamera: true,
    maxDevices: 1,
    allowResume: false,
    warningThreshold: 15,
    autoSubmitThreshold: 70,
  },
};

interface ExamMonitoringPanelProps {
  exam: TeacherExam;
  classId: number;
  onClose: () => void;
}

function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-[var(--color-danger)]'
      : tone === 'warning'
        ? 'text-[var(--color-warning)]'
        : tone === 'success'
          ? 'text-[var(--color-success)]'
          : tone === 'info'
            ? 'text-[var(--color-accent)]'
            : 'text-[var(--color-text-primary)]';

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-3">
      <div className={`text-xl font-bold tabular-nums ${toneClass}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
    </div>
  );
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return formatDate(value, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }, 'en-US');
}

export function ExamMonitoringPanel({ exam, classId, onClose }: ExamMonitoringPanelProps) {
  const [data, setData] = useState<ExamMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ExamMonitoringStudent['status']>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | ExamMonitoringStudent['riskLevel']>('all');
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null);
  const [settings, setSettings] = useState<ExamSecuritySettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [ipRangesText, setIpRangesText] = useState('');
  const [evidence, setEvidence] = useState<AttemptEvidenceData | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<ProctorReviewDecision>('WATCH');
  const [reviewRiskLevel, setReviewRiskLevel] = useState<SecurityRiskLevel>('WATCH');
  const [reviewSummary, setReviewSummary] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const { liveVersion } = useExamMonitor(exam.id);

  const fetchMonitoring = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await getExamMonitoring(exam.id, { classId });
      setData(result);
    } catch {
      toast.error('Failed to load monitoring data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId, exam.id]);

  useEffect(() => {
    fetchMonitoring();
  }, [fetchMonitoring]);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const result = await getExamSecuritySettings(exam.id);
        if (cancelled) return;
        setSettings(result);
        setIpRangesText(result.allowedIpRanges.join('\n'));
      } catch {
        toast.error('Failed to load security settings.');
      }
    }
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [exam.id]);

  useEffect(() => {
    const interval = setInterval(() => fetchMonitoring(true), 15_000);
    return () => clearInterval(interval);
  }, [fetchMonitoring]);

  useEffect(() => {
    if (liveVersion === 0) return;
    const handle = setTimeout(() => fetchMonitoring(true), 500);
    return () => clearTimeout(handle);
  }, [fetchMonitoring, liveVersion]);

  const filteredStudents = useMemo(() => {
    const rows = data?.students ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const name = `${row.student.studentName ?? ''} ${row.student.studentUsername} ${
        row.student.studentCode ?? ''
      }`.toLowerCase();
      const matchSearch = q.length === 0 || name.includes(q);
      const matchStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchRisk = riskFilter === 'all' || row.riskLevel === riskFilter;
      return matchSearch && matchStatus && matchRisk;
    });
  }, [data?.students, riskFilter, search, statusFilter]);

  const updateSetting = <K extends keyof ExamSecuritySettings>(
    key: K,
    value: ExamSecuritySettings[K],
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSettingsSaving(true);
    try {
      const saved = await updateExamSecuritySettings(exam.id, {
        ...settings,
        allowedIpRanges: ipRangesText
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setSettings(saved);
      setIpRangesText(saved.allowedIpRanges.join('\n'));
      toast.success('Security settings saved.');
    } catch {
      toast.error('Failed to save security settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const openEvidence = async (attemptId: number) => {
    setEvidenceLoading(true);
    try {
      const result = await getAttemptEvidence(exam.id, attemptId);
      setEvidence(result);
      setReviewDecision(result.review?.decision ?? 'WATCH');
      setReviewRiskLevel(result.review?.finalRiskLevel ?? result.risk.riskLevel);
      setReviewSummary(result.review?.summary ?? '');
    } catch {
      toast.error('Failed to load evidence report.');
    } finally {
      setEvidenceLoading(false);
    }
  };

  const submitReview = async () => {
    if (!evidence) return;
    setReviewSaving(true);
    try {
      await saveProctorReview(exam.id, evidence.attempt.id, {
        decision: reviewDecision,
        finalRiskLevel: reviewRiskLevel,
        summary: reviewSummary.trim() || null,
      });
      toast.success('Review saved.');
      await openEvidence(evidence.attempt.id);
      await fetchMonitoring(true);
    } catch {
      toast.error('Failed to save review.');
    } finally {
      setReviewSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] py-10">
        <div className="flex justify-center">
          <Spinner size="md" label="Loading monitoring" />
        </div>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--color-primary-soft-strong)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-bold text-[var(--color-text-primary)]">
              Monitoring: {exam.title}
            </h4>
            {refreshing && <Badge variant="info" size="sm">Syncing</Badge>}
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Last updated {data ? formatDateTime(data.updatedAt) : '-'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => setSettingsOpen((open) => !open)}>
            Security
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchMonitoring(true)}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {settingsOpen && settings && (
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4">
          <div className="grid gap-4 lg:grid-cols-[220px_1fr_220px]">
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-[var(--color-text-primary)]">Security level</span>
              <select
                value={settings.securityLevel}
                onChange={(e) => {
                  const level = e.target.value as ExamSecuritySettings['securityLevel'];
                  setSettings((prev) =>
                    prev ? { ...prev, ...SECURITY_PRESETS[level], securityLevel: level } : prev,
                  );
                }}
                className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
              >
                {SECURITY_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ['requirePreCheck', 'Require pre-check'],
                ['requireFullscreen', 'Require fullscreen'],
                ['blockCopyPaste', 'Block clipboard'],
                ['blockRightClick', 'Block right-click'],
                ['blockShortcuts', 'Block shortcuts'],
                ['requireCamera', 'Require camera'],
                ['allowResume', 'Allow resume'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(settings[key as keyof ExamSecuritySettings])}
                    onChange={(e) =>
                      updateSetting(
                        key as keyof ExamSecuritySettings,
                        e.target.checked as never,
                      )
                    }
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
              <label className="space-y-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                Warning
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.warningThreshold}
                  onChange={(e) => updateSetting('warningThreshold', Number(e.target.value))}
                  className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2 text-sm text-[var(--color-text-primary)] focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                Auto-submit
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.autoSubmitThreshold ?? ''}
                  onChange={(e) =>
                    updateSetting(
                      'autoSubmitThreshold',
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2 text-sm text-[var(--color-text-primary)] focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                Devices
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.maxDevices}
                  onChange={(e) => updateSetting('maxDevices', Number(e.target.value))}
                  className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2 text-sm text-[var(--color-text-primary)] focus:outline-none"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-[var(--color-text-primary)]">Allowed IP ranges</span>
              <textarea
                value={ipRangesText}
                onChange={(e) => setIpRangesText(e.target.value)}
                placeholder="One IP or CIDR range per line. Leave empty for no restriction."
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </label>
            <Button variant="primary" isLoading={settingsSaving} onClick={saveSettings}>
              Save Security
            </Button>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5 xl:grid-cols-10">
          <StatTile label="Students" value={summary.totalStudents} />
          <StatTile label="In Progress" value={summary.inProgress} tone="info" />
          <StatTile label="Submitted" value={summary.submitted} tone="success" />
          <StatTile label="Not Started" value={summary.notStarted} />
          <StatTile label="Avg Score" value={summary.avgScore ?? '-'} tone="success" />
          <StatTile label="Pass Rate" value={summary.passRate === null ? '-' : `${summary.passRate}%`} tone="success" />
          <StatTile label="Watch" value={summary.watchCount ?? 0} tone="info" />
          <StatTile label="Review" value={summary.mediumRiskCount ?? summary.suspiciousCount} tone="warning" />
          <StatTile label="High Risk" value={summary.highRiskCount} tone="danger" />
          <StatTile label="Critical" value={summary.criticalRiskCount ?? 0} tone="danger" />
        </div>
      )}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft-strong)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="NOT_STARTED">Not Started</option>
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as typeof riskFilter)}
          className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
        >
          <option value="all">All risk levels</option>
          <option value="critical">Critical</option>
          <option value="high">High Risk</option>
          <option value="medium">Review</option>
          <option value="watch">Watch</option>
          <option value="low">Normal</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border-subtle)]">
        <div className="hidden grid-cols-[minmax(190px,1.5fr)_120px_140px_120px_130px_120px] gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] lg:grid">
          <span>Student</span>
          <span>Status</span>
          <span>Progress / Score</span>
          <span>Time</span>
          <span>Cheating</span>
          <span>Activity</span>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
            No matching students.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {filteredStudents.map((row) => {
              const status = STATUS_CONFIG[row.status];
              const risk = RISK_CONFIG[row.riskLevel];
              const progress = percentage(row.answeredQuestions, row.totalQuestions);
              const expanded = row.attemptId !== null && expandedAttemptId === row.attemptId;
              const timeValue =
                row.status === 'IN_PROGRESS'
                  ? row.timeRemainingSec !== null
                    ? formatDuration(row.timeRemainingSec)
                    : '-'
                  : row.timeSpentSec !== null
                    ? formatDuration(row.timeSpentSec)
                    : '-';

              return (
                <div key={`${row.student.studentId}-${row.attemptId ?? 'none'}`} className="bg-[var(--color-bg-card)]">
                  <button
                    type="button"
                    onClick={() => setExpandedAttemptId(expanded ? null : row.attemptId)}
                    disabled={row.attemptId === null}
                    className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-subtle)] disabled:cursor-default disabled:hover:bg-transparent lg:grid-cols-[minmax(190px,1.5fr)_120px_140px_120px_130px_120px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-xs font-bold text-white">
                          {(row.student.studentName || row.student.studentUsername).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                            {row.student.studentName || row.student.studentUsername}
                          </div>
                          <div className="truncate text-xs text-[var(--color-text-muted)]">
                            @{row.student.studentUsername}
                            {row.student.studentCode ? ` | ${row.student.studentCode}` : ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center lg:block">
                      <Badge variant={status.variant} size="sm" dot>{status.label}</Badge>
                    </div>

                    <div className="space-y-1">
                      {row.score !== null ? (
                        <div className="text-sm font-bold text-[var(--color-text-primary)]">
                          {row.score.toFixed(1)} / 10
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-[var(--color-text-primary)]">
                          {row.answeredQuestions}/{row.totalQuestions} questions
                        </div>
                      )}
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-primary)]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                      {timeValue}
                      <div className="mt-0.5 text-[11px] font-normal text-[var(--color-text-muted)]">
                        {row.status === 'IN_PROGRESS' ? 'remaining' : formatDateTime(row.submittedAt)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Badge variant={risk.variant} size="sm">{risk.label}</Badge>
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        {row.violationCount} events
                      </div>
                    </div>

                    <div className="text-xs text-[var(--color-text-muted)]">
                      {formatDateTime(row.lastActivityAt)}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-4 py-3">
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-[var(--color-text-muted)]">
                          Risk score: <span className="font-bold text-[var(--color-text-primary)]">{row.riskScore}/100</span>
                          {row.securitySession?.ipAddress ? ` | IP ${row.securitySession.ipAddress}` : ''}
                          {row.securitySession?.lastHeartbeatAt
                            ? ` | Heartbeat ${formatDateTime(row.securitySession.lastHeartbeatAt)}`
                            : ''}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (row.attemptId) void openEvidence(row.attemptId);
                          }}
                        >
                          Evidence
                        </Button>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div>
                          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                            Warning Flags
                          </div>
                          {row.flags.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)]">No warnings.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {row.flags.map((flag) => (
                                <Badge key={flag} variant="warning" size="sm">{flag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                            Recent Violations
                          </div>
                          {row.recentViolations.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)]">No scored violations.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {row.recentViolations.map((violation) => (
                                <li
                                  key={violation.id}
                                  className="rounded-lg bg-[var(--color-bg-card)] px-3 py-2 text-xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[var(--color-text-primary)]">
                                      {violation.message}
                                    </span>
                                    <Badge
                                      variant={violation.severity === 'HIGH' || violation.severity === 'CRITICAL' ? 'danger' : 'warning'}
                                      size="sm"
                                    >
                                      +{violation.riskPoints}
                                    </Badge>
                                  </div>
                                  <div className="mt-1 text-[var(--color-text-muted)]">
                                    {formatDateTime(violation.occurredAt)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                            Recent Timeline
                          </div>
                          {row.recentEvents.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)]">No events yet.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {row.recentEvents.map((event) => (
                                <li
                                  key={event.id}
                                  className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-bg-card)] px-3 py-2 text-xs"
                                >
                                  <span className="font-semibold text-[var(--color-text-primary)]">
                                    {EVENT_LABELS[event.type] ?? event.type}
                                  </span>
                                  <span className="shrink-0 text-[var(--color-text-muted)]">
                                    {formatDateTime(event.occurredAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {evidenceLoading && (
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] py-8">
          <div className="flex justify-center">
            <Spinner size="sm" label="Loading evidence" />
          </div>
        </div>
      )}

      {evidence && !evidenceLoading && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Evidence Report
              </p>
              <h4 className="mt-1 text-base font-bold text-[var(--color-text-primary)]">
                {evidence.student.name || evidence.student.username}
              </h4>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Attempt #{evidence.attempt.id} | Started {formatDateTime(evidence.attempt.startedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  evidence.risk.riskLevel === 'CRITICAL' || evidence.risk.riskLevel === 'HIGH'
                    ? 'danger'
                    : evidence.risk.riskLevel === 'MEDIUM'
                      ? 'warning'
                      : 'info'
                }
              >
                {evidence.risk.riskLevel} {evidence.risk.riskScore}/100
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setEvidence(null)}>
                Close
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Session
                </div>
                <dl className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
                  <div className="flex justify-between gap-3">
                    <dt>IP</dt>
                    <dd className="font-semibold text-[var(--color-text-primary)]">
                      {evidence.securitySession?.ipAddress ?? '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Device</dt>
                    <dd className="max-w-[220px] truncate font-semibold text-[var(--color-text-primary)]">
                      {evidence.securitySession?.deviceId ?? '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Last heartbeat</dt>
                    <dd className="font-semibold text-[var(--color-text-primary)]">
                      {formatDateTime(evidence.securitySession?.lastHeartbeatAt ?? null)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Fullscreen</dt>
                    <dd className="font-semibold text-[var(--color-text-primary)]">
                      {evidence.securitySession?.fullscreenState ? 'Active' : 'Not active'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Review Decision
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select
                    value={reviewDecision}
                    onChange={(e) => setReviewDecision(e.target.value as ProctorReviewDecision)}
                    className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none"
                  >
                    {REVIEW_DECISIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={reviewRiskLevel}
                    onChange={(e) => setReviewRiskLevel(e.target.value as SecurityRiskLevel)}
                    className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none"
                  >
                    {REVIEW_RISK_LEVELS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={reviewSummary}
                  onChange={(e) => setReviewSummary(e.target.value)}
                  placeholder="Add teacher notes for this evidence review."
                  rows={4}
                  className="mt-2 w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="primary" isLoading={reviewSaving} onClick={submitReview}>
                    Save Review
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Evidence Timeline
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {evidence.violations.length} scored violations
                </span>
              </div>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {evidence.violations.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">No scored violations for this attempt.</p>
                ) : (
                  evidence.violations.map((violation) => (
                    <div
                      key={violation.id}
                      className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-[var(--color-text-primary)]">
                            {violation.message}
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            {EVENT_LABELS[violation.eventType] ?? violation.eventType} | {formatDateTime(violation.occurredAt)}
                          </div>
                        </div>
                        <Badge
                          size="sm"
                          variant={violation.severity === 'HIGH' || violation.severity === 'CRITICAL' ? 'danger' : 'warning'}
                        >
                          +{violation.riskPoints}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
