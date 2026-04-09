import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
  getSystemConfigs,
  updateSystemConfigs,
  getMonitoring,
  listActivityLogs,
  listBackups,
  createBackup,
  restoreBackup,
} from '@/services/admin.api';
import type {
  SystemConfig,
  MonitoringData,
  ActivityLog,
  Backup,
} from '@/types/admin';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ChartTooltip,
  Legend
);

type Tab = 'config' | 'performance' | 'logs' | 'backup';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'config',
    label: 'Configuration',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'logs',
    label: 'Activity Logs',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: 'backup',
    label: 'Backup',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
];

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState<Tab>('config');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure system settings, monitor performance, and manage backups.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'config' && <ConfigTab />}
      {activeTab === 'performance' && <PerformanceTab />}
      {activeTab === 'logs' && <LogsTab />}
      {activeTab === 'backup' && <BackupTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// CONFIG TAB
// ═══════════════════════════════════════════════

function ConfigTab() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSystemConfigs();
      const items = Array.isArray(data) ? data : [];
      setConfigs(items);
      const vals: Record<string, string> = {};
      items.forEach((c) => { vals[c.configKey] = c.configValue; });
      setEditValues(vals);
    } catch {
      toast.error('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = Object.entries(editValues).map(([key, value]) => ({
        key,
        value,
        description: configs.find((c) => c.configKey === key)?.description ?? undefined,
      }));
      await updateSystemConfigs({ configs: payload });
      toast.success('Configuration saved');
      fetchConfigs();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <Card padding="md">
      <div className="space-y-6">
        {configs.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">
            No configuration entries found. They will appear here once created.
          </p>
        ) : (
          configs.map((cfg) => (
            <div key={cfg.id} className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                {cfg.configKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </label>
              {cfg.description && (
                <p className="text-xs text-slate-400">{cfg.description}</p>
              )}
              <input
                type="text"
                value={editValues[cfg.configKey] ?? ''}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, [cfg.configKey]: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          ))
        )}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button onClick={handleSave} isLoading={saving}>Save Configuration</Button>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════
// PERFORMANCE TAB (real-time charts)
// ═══════════════════════════════════════════════

const MAX_HISTORY = 30;

function PerformanceTab() {
  const [monitoring, setMonitoring] = useState<MonitoringData | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMonitoring = useCallback(async () => {
    try {
      const data = await getMonitoring();
      setMonitoring(data);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCpuHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), data.cpu?.usage ?? 0]);
      setMemHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), data.memory?.percentage ?? 0]);
      setLabels((prev) => [...prev.slice(-(MAX_HISTORY - 1)), now]);
    } catch {
      // silently retry next interval
    }
  }, []);

  useEffect(() => {
    fetchMonitoring();
    intervalRef.current = setInterval(fetchMonitoring, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchMonitoring]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 } as const,
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { callback: (v: number | string) => `${v}%`, font: { size: 11 } },
        grid: { color: '#f1f5f9' },
      },
      x: {
        ticks: { maxTicksLimit: 8, font: { size: 10 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  const cpuData = {
    labels,
    datasets: [{
      data: cpuHistory,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2,
    }],
  };

  const memData = {
    labels,
    datasets: [{
      data: memHistory,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2,
    }],
  };

  const uptimeH = monitoring?.uptime ? Math.floor(monitoring.uptime / 3600) : 0;
  const uptimeM = monitoring?.uptime ? Math.floor((monitoring.uptime % 3600) / 60) : 0;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="CPU Usage" value={`${Math.round(monitoring?.cpu?.usage ?? 0)}%`} color="blue" />
        <MiniStat label="Memory" value={`${Math.round(monitoring?.memory?.percentage ?? 0)}%`} color="emerald" />
        <MiniStat label="Uptime" value={`${uptimeH}h ${uptimeM}m`} color="violet" />
        <MiniStat label="CPU Cores" value={`${monitoring?.cpu?.cores ?? '-'}`} color="amber" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="CPU Usage" padding="md">
          <div className="h-56">
            <Line data={cpuData} options={chartOptions as any} />
          </div>
          <p className="mt-2 text-xs text-slate-400 text-center">Updated every 5 seconds</p>
        </Card>
        <Card title="Memory Usage" padding="md">
          <div className="h-56">
            <Line data={memData} options={chartOptions as any} />
          </div>
          <p className="mt-2 text-xs text-slate-400 text-center">
            {monitoring?.memory
              ? `${formatMB(monitoring.memory.used)} / ${formatMB(monitoring.memory.total)}`
              : 'Loading...'}
          </p>
        </Card>
      </div>

      {/* System Info */}
      <Card title="System Information" padding="md">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow label="Node.js" value={monitoring?.nodeVersion ?? '—'} />
          <InfoRow label="Platform" value={monitoring?.platform ?? '—'} />
          <InfoRow label="CPU Cores" value={String(monitoring?.cpu?.cores ?? '—')} />
          <InfoRow label="Total Memory" value={monitoring?.memory ? formatMB(monitoring.memory.total) : '—'} />
        </div>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <Card padding="md">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${bgMap[color]?.split(' ')[1] ?? 'text-slate-900'}`}>{value}</p>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function formatMB(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  return `${bytes} B`;
}

// ═══════════════════════════════════════════════
// LOGS TAB
// ═══════════════════════════════════════════════

function LogsTab() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listActivityLogs({
        page,
        pageSize,
        action: actionFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortOrder: 'desc',
      });
      setLogs(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, startDate, endDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => { setPage(1); }, [actionFilter, startDate, endDate]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Action</label>
            <input
              type="text"
              placeholder="e.g. LOGIN, CREATE_USER"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setActionFilter(''); setStartDate(''); setEndDate(''); }}
          >
            Clear
          </Button>
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-3 text-sm text-slate-500">No activity logs found</p>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Time</TableHeaderCell>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell>Entity</TableHeaderCell>
                <TableHeaderCell>IP Address</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-slate-900">
                      {log.user?.fullName ?? log.user?.username ?? 'System'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {log.entityType ? `${log.entityType}${log.entityId ? ` #${log.entityId}` : ''}` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 font-mono">
                    {log.ipAddress ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} ({total} records)
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════
// BACKUP TAB
// ═══════════════════════════════════════════════

function BackupTab() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBackups();
      setBackups(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  async function handleCreateBackup() {
    setCreating(true);
    try {
      await createBackup();
      toast.success('Backup created successfully');
      fetchBackups();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Backup failed');
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore(id: number) {
    if (!window.confirm('Are you sure you want to restore this backup? This will overwrite current data.')) return;
    try {
      await restoreBackup(id);
      toast.success('Backup restored successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Restore failed');
    }
  }

  const statusBadge: Record<string, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
    COMPLETED: { variant: 'success', label: 'Completed' },
    IN_PROGRESS: { variant: 'warning', label: 'In Progress' },
    FAILED: { variant: 'danger', label: 'Failed' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{backups.length} backup(s) available</p>
        <Button onClick={handleCreateBackup} isLoading={creating}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          Backup Now
        </Button>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-500">No backups yet</p>
            <p className="mt-1 text-xs text-slate-400">Click "Backup Now" to create your first backup.</p>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Filename</TableHeaderCell>
                <TableHeaderCell>Size</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created By</TableHeaderCell>
                <TableHeaderCell>Created At</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {backups.map((b) => {
                const si = statusBadge[b.status] ?? statusBadge.COMPLETED;
                return (
                  <TableRow key={b.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-mono text-xs text-slate-700">{b.filename}</TableCell>
                    <TableCell className="text-sm">
                      {b.fileSizeMb ? `${Number(b.fileSizeMb).toFixed(1)} MB` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={si.variant}>{si.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.creator?.fullName ?? b.creator?.username ?? `User #${b.createdBy}`}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(b.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {b.status === 'COMPLETED' && (
                        <Button variant="outline" size="sm" onClick={() => handleRestore(b.id)}>
                          Restore
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
