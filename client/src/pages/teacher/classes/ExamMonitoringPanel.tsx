import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useExamMonitor } from '@/hooks/useExamMonitor';
import { getExamMonitoring } from '@/services/exam.api';
import type {
  AttemptMonitoringEventType,
  ExamMonitoringData,
  ExamMonitoringStudent,
  TeacherExam,
} from '@/types/exam';
import { formatDate, formatDuration } from '@/utils/format';

const STATUS_CONFIG: Record<
  ExamMonitoringStudent['status'],
  { label: string; variant: BadgeVariant }
> = {
  NOT_STARTED: { label: 'Chưa bắt đầu', variant: 'neutral' },
  IN_PROGRESS: { label: 'Đang làm', variant: 'info' },
  SUBMITTED: { label: 'Đã nộp', variant: 'success' },
  GRADED: { label: 'Đã chấm', variant: 'success' },
};

const RISK_CONFIG: Record<ExamMonitoringStudent['riskLevel'], { label: string; variant: BadgeVariant }> = {
  low: { label: 'Bình thường', variant: 'success' },
  medium: { label: 'Cần xem', variant: 'warning' },
  high: { label: 'Rủi ro cao', variant: 'danger' },
};

const EVENT_LABELS: Record<AttemptMonitoringEventType, string> = {
  STARTED: 'Bắt đầu',
  RESUMED: 'Tiếp tục',
  HEARTBEAT: 'Heartbeat',
  ANSWER_SAVED: 'Lưu bài',
  TAB_HIDDEN: 'Chuyển tab',
  WINDOW_BLUR: 'Mất focus',
  COPY: 'Copy',
  PASTE: 'Paste',
  CONTEXT_MENU: 'Menu chuột phải',
  SHORTCUT_BLOCKED: 'Phím tắt bị chặn',
  OFFLINE: 'Mất kết nối',
  ONLINE: 'Kết nối lại',
  SUBMITTED: 'Nộp bài',
  AUTO_SUBMITTED: 'Tự động nộp',
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
  }, 'vi-VN');
}

export function ExamMonitoringPanel({ exam, classId, onClose }: ExamMonitoringPanelProps) {
  const [data, setData] = useState<ExamMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ExamMonitoringStudent['status']>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | ExamMonitoringStudent['riskLevel']>('all');
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null);
  const { liveVersion } = useExamMonitor(exam.id);

  const fetchMonitoring = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await getExamMonitoring(exam.id, { classId });
      setData(result);
    } catch {
      toast.error('Không tải được dữ liệu giám sát.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId, exam.id]);

  useEffect(() => {
    fetchMonitoring();
  }, [fetchMonitoring]);

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
              Giám sát: {exam.title}
            </h4>
            {refreshing && <Badge variant="info" size="sm">Đang đồng bộ</Badge>}
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Cập nhật lúc {data ? formatDateTime(data.updatedAt) : '-'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchMonitoring(true)}>
            Làm mới
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          <StatTile label="Học sinh" value={summary.totalStudents} />
          <StatTile label="Đang làm" value={summary.inProgress} tone="info" />
          <StatTile label="Đã nộp" value={summary.submitted} tone="success" />
          <StatTile label="Chưa làm" value={summary.notStarted} />
          <StatTile label="Điểm TB" value={summary.avgScore ?? '-'} tone="success" />
          <StatTile label="Đạt" value={summary.passRate === null ? '-' : `${summary.passRate}%`} tone="success" />
          <StatTile label="Cần xem" value={summary.suspiciousCount} tone="warning" />
          <StatTile label="Rủi ro cao" value={summary.highRiskCount} tone="danger" />
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
            placeholder="Tìm học sinh..."
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft-strong)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="IN_PROGRESS">Đang làm</option>
          <option value="SUBMITTED">Đã nộp</option>
          <option value="NOT_STARTED">Chưa bắt đầu</option>
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as typeof riskFilter)}
          className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
        >
          <option value="all">Tất cả rủi ro</option>
          <option value="high">Rủi ro cao</option>
          <option value="medium">Cần xem</option>
          <option value="low">Bình thường</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border-subtle)]">
        <div className="hidden grid-cols-[minmax(190px,1.5fr)_120px_140px_120px_130px_120px] gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] lg:grid">
          <span>Học sinh</span>
          <span>Trạng thái</span>
          <span>Tiến độ / điểm</span>
          <span>Thời gian</span>
          <span>Gian lận</span>
          <span>Hoạt động</span>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
            Không có học sinh phù hợp.
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
                            {row.student.studentCode ? ` · ${row.student.studentCode}` : ''}
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
                          {row.answeredQuestions}/{row.totalQuestions} câu
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
                        {row.status === 'IN_PROGRESS' ? 'còn lại' : formatDateTime(row.submittedAt)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Badge variant={risk.variant} size="sm">{risk.label}</Badge>
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        {row.violationCount} sự kiện
                      </div>
                    </div>

                    <div className="text-xs text-[var(--color-text-muted)]">
                      {formatDateTime(row.lastActivityAt)}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-4 py-3">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                            Cờ cảnh báo
                          </div>
                          {row.flags.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)]">Không có cảnh báo.</p>
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
                            Timeline gần nhất
                          </div>
                          {row.recentEvents.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)]">Chưa có sự kiện.</p>
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
    </div>
  );
}
