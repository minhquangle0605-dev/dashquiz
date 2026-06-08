import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import type {
  GraphNode,
  LearningPathResponse,
  Recommendation,
  RecommendationReasonCode,
} from '@/services/knowledgeGraph.api';
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

const REASON_CHIP: Record<RecommendationReasonCode, { label: string; cls: string }> = {
  PREREQ_GAP: { label: 'Prerequisite gap', cls: 'bg-violet-100 text-violet-700' },
  LOW_MASTERY: { label: 'Low mastery', cls: 'bg-rose-100 text-rose-700' },
  LOW_CONFIDENCE: { label: 'Low confidence', cls: 'bg-amber-100 text-amber-700' },
  STALE_MASTERY: { label: 'Needs review', cls: 'bg-sky-100 text-sky-700' },
};

/**
 * Optional self-practice action shown on each recommendation. Students get this;
 * read-only viewers (parents/teachers) omit it. The parent component owns the
 * mutation; `pendingNodeId` is the node currently being generated, if any.
 */
export interface PracticeAction {
  onGenerate: (nodeId: number) => void;
  pendingNodeId: number | null;
}

export interface KnowledgeGraphViewProps {
  /** Nodes for the selected scope (already filtered by subject, if any). */
  nodes: GraphNode[];
  /** Recommendations for the selected scope (already filtered by subject, if any). */
  recommendations: Recommendation[];
  /** Fetch the prerequisite learning path for a node (scoped to the viewed learner). */
  fetchLearningPath: (nodeId: number) => Promise<LearningPathResponse>;
  /** React-query key for a learning-path request — keep unique per learner/role. */
  pathQueryKey: (nodeId: number) => unknown[];
  /** When set, render a self-practice button on each recommendation (student only). */
  practice?: PracticeAction;
  /** Rendered when the learner has no measured mastery yet. */
  emptyState?: ReactNode;
  recommendationsTitle?: string;
  recommendationsSubtitle?: string;
}

/**
 * Full mastery visualization shared by the student (interactive) and parent
 * (read-only) Knowledge Graph pages: overall gauge, level distribution, key
 * insights, a mastery profile chart, recommendations, and a topic tree.
 */
export function KnowledgeGraphView({
  nodes,
  recommendations,
  fetchLearningPath,
  pathQueryKey,
  practice,
  emptyState,
  recommendationsTitle = 'Recommended next steps',
  recommendationsSubtitle = 'Prioritised by prerequisite gaps, then weakest areas.',
}: KnowledgeGraphViewProps) {
  const summary = useMemo(() => computeSummary(nodes), [nodes]);

  if (summary.attemptedNodes === 0) {
    return <>{emptyState ?? <DefaultEmptyState />}</>;
  }

  return (
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
        <Card title={recommendationsTitle} subtitle={recommendationsSubtitle}>
          <ul className="space-y-2">
            {recommendations.map((r) => (
              <RecommendationItem
                key={r.nodeId}
                rec={r}
                fetchLearningPath={fetchLearningPath}
                pathQueryKey={pathQueryKey}
                practice={practice}
              />
            ))}
          </ul>
        </Card>
      )}

      {/* Topic tree */}
      <Card title="Topic breakdown" subtitle="Expand a subject to see chapters and skills.">
        <KnowledgeTree nodes={nodes} />
      </Card>
    </>
  );
}

function DefaultEmptyState() {
  return (
    <Card>
      <div className="py-10 text-center">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">No mastery data yet</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Mastery fills in automatically once exams are taken and submitted.
        </p>
      </div>
    </Card>
  );
}

// ─── Recommendation row (with prerequisite learning path) ──

function RecommendationItem({
  rec,
  fetchLearningPath,
  pathQueryKey,
  practice,
}: {
  rec: Recommendation;
  fetchLearningPath: (nodeId: number) => Promise<LearningPathResponse>;
  pathQueryKey: (nodeId: number) => unknown[];
  practice?: PracticeAction;
}) {
  const [showPath, setShowPath] = useState(false);
  const lvl = levelFromScore(rec.masteryScore, 1);
  const chip = REASON_CHIP[rec.reasonCode];

  const { data: path, isLoading: pathLoading } = useQuery({
    queryKey: pathQueryKey(rec.nodeId),
    queryFn: () => fetchLearningPath(rec.nodeId),
    enabled: showPath,
    staleTime: 60_000,
  });

  const practicePending = practice?.pendingNodeId === rec.nodeId;

  return (
    <li className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {rec.name}
            </span>
            {chip && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}>
                {chip.label}
              </span>
            )}
            {rec.priority === 'high' && (
              <span className="rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-danger)]">
                High priority
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
              <div
                className={`h-full rounded-full ${LEVEL_SWATCH[lvl]}`}
                style={{ width: `${Math.max(3, Math.round(rec.masteryScore))}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{rec.reason}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {rec.evidenceCount} question(s) · {CONFIDENCE_LABEL[rec.confidence] ?? ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPath((s) => !s)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
          >
            {showPath ? 'Hide path' : 'Show path'}
          </button>
          {practice && (
            <button
              type="button"
              onClick={() => practice.onGenerate(rec.nodeId)}
              disabled={practicePending}
              className="rounded-lg border border-[var(--color-primary-soft-strong)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] disabled:opacity-50"
            >
              {practicePending ? 'Building…' : 'Practice'}
            </button>
          )}
        </div>
      </div>

      {showPath && (
        <div className="mt-2 border-t border-[var(--color-border-subtle)] pt-2">
          {pathLoading ? (
            <p className="text-[11px] text-[var(--color-text-muted)]">Loading prerequisites…</p>
          ) : !path || path.steps.length <= 1 ? (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              No prerequisites recorded yet — practising this skill directly is fine.
            </p>
          ) : (
            <ol className="space-y-1">
              {path.steps.map((s, i) => (
                <li key={s.nodeId} className="flex items-center gap-2 text-[11px]">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-muted)] text-[10px] font-semibold text-[var(--color-text-muted)]">
                    {i + 1}
                  </span>
                  <span
                    className={`truncate ${
                      s.isTarget
                        ? 'font-semibold text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {s.name}
                    {s.isTarget ? ' (target)' : ''}
                  </span>
                  <span
                    className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${LEVEL_BADGE[s.weaknessLevel]}`}
                  >
                    {s.attemptCount > 0 ? `${Math.round(s.masteryScore)}%` : 'no data'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
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
      value: summary.strongest
        ? `${summary.strongest.name} · ${summary.strongest.masteryScore}%`
        : '—',
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
      <Card title="Mastery by chapter" subtitle="How well each area is mastered (0–100).">
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
        label: 'Mastery',
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
      subtitle="Strengths and weaknesses across chapters at a glance."
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
            <div className="flex shrink-0 items-center gap-1.5">
              {node.stale && (
                <span
                  className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
                  title="Not practised recently — due for review"
                >
                  Stale
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEVEL_BADGE[node.weaknessLevel]}`}
              >
                {LEVEL_LABEL[node.weaknessLevel]}
              </span>
            </div>
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
              {node.daysSinceLastPractice != null &&
                ` · ${lastPractisedLabel(node.daysSinceLastPractice)}`}
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

function lastPractisedLabel(days: number): string {
  if (days <= 0) return 'practised today';
  if (days === 1) return 'practised 1d ago';
  return `practised ${days}d ago`;
}
