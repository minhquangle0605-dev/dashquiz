import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Radar, Bar } from 'react-chartjs-2';

import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { getMyKnowledgeGraph, type GraphNode } from '@/services/knowledgeGraph.api';
import {
  CONFIDENCE_LABEL,
  LEVEL_BADGE,
  LEVEL_HEX,
  LEVEL_LABEL,
  LEVEL_ORDER,
  LEVEL_SWATCH,
  levelFromScore,
} from '@/utils/knowledgeGraph';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
);

const AXIS_COLOR = '#94a3b8';
const GRID_COLOR = 'rgba(148, 163, 184, 0.18)';
const LABEL_COLOR = '#64748b';

export default function KnowledgeGraphPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-knowledge-graph'],
    queryFn: () => getMyKnowledgeGraph(),
  });

  const [subject, setSubject] = useState<number | 'all'>('all');

  const subjectOptions = useMemo(
    () => (data?.nodes ?? []).filter((n) => n.type === 'SUBJECT'),
    [data],
  );

  const nodes = useMemo(() => {
    const all = data?.nodes ?? [];
    return subject === 'all' ? all : all.filter((n) => n.subjectId === subject);
  }, [data, subject]);

  const summary = useMemo(() => computeSummary(nodes), [nodes]);

  const recommendations = useMemo(() => {
    const recs = data?.recommendations ?? [];
    return subject === 'all' ? recs : recs.filter((r) => r.subjectId === subject);
  }, [data, subject]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <p className="text-center text-sm text-[var(--color-danger)]">
            Failed to load your knowledge graph.
          </p>
        </Card>
      </div>
    );
  }

  const hasData = summary.attemptedNodes > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Knowledge Graph</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Your strengths and weaknesses by subject, chapter, and skill.
          </p>
        </div>
        {subjectOptions.length > 1 && (
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-secondary)] shadow-sm focus:border-[var(--color-primary)] focus:outline-none"
          >
            <option value="all">All subjects</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.subjectId ?? s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!hasData ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              No mastery data yet
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Take and submit an exam — your knowledge graph fills in automatically.
            </p>
            <Link
              to="/student/exams"
              className="mt-4 inline-block rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
            >
              Browse exams
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Row 1 — Overall gauge · Level distribution · Key insights */}
          <div className="grid gap-4 lg:grid-cols-3">
            <MasteryGaugeCard summary={summary} />
            <LevelDistributionCard summary={summary} />
            <InsightsCard summary={summary} />
          </div>

          {/* Row 2 — Mastery profile chart */}
          <MasteryProfileCard nodes={nodes} />

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Card title="Recommended to review next">
              <ul className="space-y-2">
                {recommendations.map((r) => {
                  const lvl = levelFromScore(r.masteryScore, 1);
                  return (
                    <li
                      key={r.nodeId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                            {r.name}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              r.priority === 'high'
                                ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                                : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                            }`}
                          >
                            {r.priority === 'high' ? 'High priority' : 'Review'}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                            <div
                              className={`h-full rounded-full ${LEVEL_SWATCH[lvl]}`}
                              style={{ width: `${Math.max(3, Math.round(r.masteryScore))}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                            {r.reason}
                          </span>
                        </div>
                      </div>
                      <Link
                        to="/student/exams"
                        className="shrink-0 rounded-lg border border-[var(--color-primary-soft-strong)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                      >
                        Practice
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* Topic tree */}
          <Card title="Topic breakdown" subtitle="Expand a subject to see chapters and skills.">
            <KnowledgeTree nodes={nodes} />
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Row-1 cards ────────────────────────────────────

function MasteryGaugeCard({ summary }: { summary: Summary }) {
  const level = levelFromScore(summary.overallMastery, summary.attemptedNodes);
  const color = LEVEL_HEX[level];
  const data = {
    labels: ['Mastery', 'Remaining'],
    datasets: [
      {
        data: [summary.overallMastery, Math.max(0, 100 - summary.overallMastery)],
        backgroundColor: [color, GRID_COLOR],
        borderWidth: 0,
        circumference: 360,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '78%',
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  } as const;

  return (
    <Card>
      <p className="text-sm font-medium text-[var(--color-text-muted)]">Overall mastery</p>
      <div className="relative mx-auto mt-3 h-44 w-44">
        <Doughnut data={data} options={options} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold" style={{ color }}>
            {summary.overallMastery}%
          </span>
          <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {LEVEL_LABEL[level]}
          </span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
        {summary.attemptedNodes} learning area(s) measured
      </p>
    </Card>
  );
}

function LevelDistributionCard({ summary }: { summary: Summary }) {
  const total = LEVEL_ORDER.reduce((a, l) => a + summary.counts[l], 0);
  const data = {
    labels: LEVEL_ORDER.map((l) => LEVEL_LABEL[l]),
    datasets: [
      {
        data: LEVEL_ORDER.map((l) => summary.counts[l]),
        backgroundColor: LEVEL_ORDER.map((l) => LEVEL_HEX[l]),
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: { legend: { display: false } },
  } as const;

  return (
    <Card>
      <p className="text-sm font-medium text-[var(--color-text-muted)]">Areas by level</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-36 w-36 shrink-0">
          {total > 0 ? (
            <>
              <Doughnut data={data} options={options} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">{total}</span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  areas
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">
              No data
            </div>
          )}
        </div>
        <ul className="flex-1 space-y-1.5">
          {LEVEL_ORDER.map((l) => (
            <li key={l} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: LEVEL_HEX[l] }}
              />
              <span className="flex-1 text-[var(--color-text-secondary)]">{LEVEL_LABEL[l]}</span>
              <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
                {summary.counts[l]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function InsightsCard({ summary }: { summary: Summary }) {
  const rows: { label: string; value: string; tone?: string }[] = [
    {
      label: 'Questions answered',
      value: String(summary.questionsAnswered),
    },
    {
      label: 'Overall accuracy',
      value: `${summary.accuracy}%`,
    },
    {
      label: 'Strongest area',
      value: summary.strongest ? `${summary.strongest.name} · ${summary.strongest.masteryScore}%` : '—',
      tone: 'good',
    },
    {
      label: 'Needs work',
      value: summary.weakest ? `${summary.weakest.name} · ${summary.weakest.masteryScore}%` : '—',
      tone: 'critical',
    },
    {
      label: 'Avg time / question',
      value: summary.avgTime != null ? `${summary.avgTime}s` : '—',
    },
  ];

  return (
    <Card>
      <p className="text-sm font-medium text-[var(--color-text-muted)]">Key insights</p>
      <dl className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-[var(--color-text-muted)]">{r.label}</dt>
            <dd
              className="truncate text-right text-sm font-semibold"
              style={{
                color:
                  r.tone === 'good'
                    ? LEVEL_HEX.strong
                    : r.tone === 'critical'
                      ? LEVEL_HEX.critical
                      : 'var(--color-text-primary)',
              }}
              title={r.value}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

// ─── Row-2 chart (radar or bar) ─────────────────────

function MasteryProfileCard({ nodes }: { nodes: GraphNode[] }) {
  const items = useMemo(() => {
    const chapters = nodes.filter((n) => n.type === 'CHAPTER' && n.attemptCount > 0);
    const source =
      chapters.length > 0 ? chapters : nodes.filter((n) => n.type === 'SKILL' && n.attemptCount > 0);
    return [...source].sort((a, b) => a.orderIndex - b.orderIndex).slice(0, 9);
  }, [nodes]);

  if (items.length === 0) return null;

  const labels = items.map((n) => truncate(n.name, 22));
  const values = items.map((n) => n.masteryScore);

  if (items.length < 3) {
    // Too few axes for a meaningful radar → horizontal bars.
    const data = {
      labels,
      datasets: [
        {
          label: 'Mastery',
          data: values,
          backgroundColor: items.map((n) => LEVEL_HEX[n.weaknessLevel]),
          borderRadius: 6,
          maxBarThickness: 36,
        },
      ],
    };
    const options = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { color: AXIS_COLOR, stepSize: 25, font: { size: 11 } },
          grid: { color: GRID_COLOR },
        },
        y: {
          ticks: { color: LABEL_COLOR, font: { size: 11 } },
          grid: { display: false },
        },
      },
    } as const;
    return (
      <Card title="Mastery by chapter" subtitle="How well you've mastered each area (0–100).">
        <div className="h-64">
          <Bar data={data} options={options} />
        </div>
      </Card>
    );
  }

  const data = {
    labels,
    datasets: [
      {
        label: 'Your mastery',
        data: values,
        backgroundColor: 'rgba(79, 70, 229, 0.15)',
        borderColor: '#4f46e5',
        borderWidth: 2,
        pointBackgroundColor: items.map((n) => LEVEL_HEX[n.weaknessLevel]),
        pointBorderColor: '#ffffff',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 25,
          color: AXIS_COLOR,
          backdropColor: 'transparent',
          font: { size: 10 },
        },
        grid: { color: GRID_COLOR },
        angleLines: { color: GRID_COLOR },
        pointLabels: { color: LABEL_COLOR, font: { size: 11 } },
      },
    },
  } as const;

  return (
    <Card
      title="Mastery profile"
      subtitle="Your strengths and weaknesses across chapters at a glance."
    >
      <div className="h-80">
        <Radar data={data} options={options} />
      </div>
    </Card>
  );
}

// ─── Tree ──────────────────────────────────────────

function KnowledgeTree({ nodes }: { nodes: GraphNode[] }) {
  const childrenOf = useMemo(() => {
    const map = new Map<number | null, GraphNode[]>();
    for (const n of nodes) {
      const key = n.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return map;
  }, [nodes]);

  // Roots = SUBJECT nodes; when a single subject is filtered, also show chapters
  // whose parent (the subject) is not in the current node set.
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const roots = useMemo(
    () => nodes.filter((n) => n.parentId == null || !nodeIds.has(n.parentId)),
    [nodes, nodeIds],
  );

  if (roots.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No topics to show.</p>
    );
  }

  return (
    <div className="space-y-1">
      {roots.map((r) => (
        <TreeRow key={r.id} node={r} childrenOf={childrenOf} depth={0} />
      ))}
    </div>
  );
}

function TreeRow({
  node,
  childrenOf,
  depth,
}: {
  node: GraphNode;
  childrenOf: Map<number | null, GraphNode[]>;
  depth: number;
}) {
  const kids = childrenOf.get(node.id) ?? [];
  const [open, setOpen] = useState(depth < 1);
  const hasKids = kids.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--color-bg-subtle)]"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => hasKids && setOpen((o) => !o)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)] ${
            hasKids ? 'hover:bg-[var(--color-bg-muted)]' : 'opacity-0'
          }`}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {hasKids ? (open ? '▾' : '▸') : ''}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {node.name}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEVEL_BADGE[node.weaknessLevel]}`}
            >
              {LEVEL_LABEL[node.weaknessLevel]}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
              <div
                className={`h-full rounded-full ${LEVEL_SWATCH[node.weaknessLevel]}`}
                style={{ width: `${node.attemptCount > 0 ? node.masteryScore : 0}%` }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-[11px] text-[var(--color-text-muted)]">
              {node.attemptCount > 0 ? `${node.masteryScore}% · ${node.attemptCount} ans` : 'no data'}
            </span>
          </div>
          {node.attemptCount > 0 && (
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              {node.correctCount}/{node.attemptCount} correct
              {node.avgTimeSec != null && ` · ${Math.round(node.avgTimeSec)}s avg`}
              {` · ${CONFIDENCE_LABEL[node.confidence] ?? ''}`}
            </p>
          )}
        </div>
      </div>

      {open && hasKids && (
        <div>
          {kids.map((k) => (
            <TreeRow key={k.id} node={k} childrenOf={childrenOf} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── client-side summary (per selected subject) ────

interface Summary {
  overallMastery: number;
  attemptedNodes: number;
  counts: Record<'critical' | 'weak' | 'medium' | 'good' | 'strong', number>;
  questionsAnswered: number;
  accuracy: number;
  strongest: GraphNode | null;
  weakest: GraphNode | null;
  avgTime: number | null;
}

function computeSummary(nodes: GraphNode[]): Summary {
  const chapters = nodes.filter((n) => n.type === 'CHAPTER' && n.attemptCount > 0);
  const totalCorrect = chapters.reduce((a, n) => a + n.correctCount, 0);
  const totalAttempt = chapters.reduce((a, n) => a + n.attemptCount, 0);
  const overallMastery =
    totalAttempt > 0 ? Math.round((totalCorrect / totalAttempt) * 1000) / 10 : 0;

  const learning = nodes.filter(
    (n) => (n.type === 'CHAPTER' || n.type === 'SKILL') && n.attemptCount > 0,
  );
  const counts = {
    critical: 0,
    weak: 0,
    medium: 0,
    good: 0,
    strong: 0,
  } as Record<'critical' | 'weak' | 'medium' | 'good' | 'strong', number>;
  for (const n of learning) {
    if (n.weaknessLevel in counts) counts[n.weaknessLevel as keyof typeof counts] += 1;
  }

  const byMastery = [...learning].sort((a, b) => b.masteryScore - a.masteryScore);
  const strongest = byMastery[0] ?? null;
  const weakest = byMastery.length > 0 ? byMastery[byMastery.length - 1] : null;

  const timed = learning.filter((n) => n.avgTimeSec != null);
  const avgTime =
    timed.length > 0
      ? Math.round(timed.reduce((a, n) => a + (n.avgTimeSec ?? 0), 0) / timed.length)
      : null;

  return {
    overallMastery,
    attemptedNodes: learning.length,
    counts,
    questionsAnswered: totalAttempt,
    accuracy: totalAttempt > 0 ? Math.round((totalCorrect / totalAttempt) * 100) : 0,
    strongest,
    weakest,
    avgTime,
  };
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
