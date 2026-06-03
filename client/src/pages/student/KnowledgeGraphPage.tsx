import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import {
  getStudentKnowledgeGraph,
  type KnowledgeGraphNode,
  type KnowledgeGraphEdge,
  type KnowledgeGraphChapter,
  type KnowledgeGraphSubject,
  type KnowledgeGraphSummary,
  type KnowledgeGraphRecommendations,
  type KnowledgeGraphRecommendation,
} from '@/services/analytics.api';

type ViewMode = 'graph' | 'chapters';
type MasteryFilter = 'all' | 'weak' | 'developing' | 'strong' | 'untouched';

interface SimNode extends d3.SimulationNodeDatum {
  id: number;
  name: string;
  chapterId: number;
  chapterName: string;
  chapterColor: string;
  subjectName: string;
  mastery: number;
  masteryLevel: KnowledgeGraphNode['masteryLevel'];
  color: KnowledgeGraphNode['color'];
  attempts: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  relationType: string;
}

const MASTERY_COLOR: Record<KnowledgeGraphNode['color'], string> = {
  red: '#ef4444',
  yellow: '#f59e0b',
  green: '#10b981',
  gray: '#cbd5e1',
};

const MASTERY_BADGE: Record<
  KnowledgeGraphNode['masteryLevel'],
  'success' | 'warning' | 'danger' | 'neutral'
> = {
  strong: 'success',
  developing: 'warning',
  weak: 'danger',
  untouched: 'neutral',
};

const MASTERY_LABEL: Record<KnowledgeGraphNode['masteryLevel'], string> = {
  strong: 'Strong',
  developing: 'Developing',
  weak: 'Weak',
  untouched: 'Not started',
};

export default function KnowledgeGraphPage() {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [nodes, setNodes] = useState<KnowledgeGraphNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeGraphEdge[]>([]);
  const [chapters, setChapters] = useState<KnowledgeGraphChapter[]>([]);
  const [subjects, setSubjects] = useState<KnowledgeGraphSubject[]>([]);
  const [summary, setSummary] = useState<KnowledgeGraphSummary | null>(null);
  const [recommendations, setRecommendations] = useState<KnowledgeGraphRecommendations | null>(
    null,
  );

  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [subjectFilter, setSubjectFilter] = useState<number | 'all'>('all');
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [showEdges, setShowEdges] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStudentKnowledgeGraph();
      setNodes(data.nodes ?? []);
      setEdges(data.edges ?? []);
      setChapters(data.chapters ?? []);
      setSubjects(data.subjects ?? []);
      setSummary(data.summary ?? null);
      setRecommendations(data.recommendations ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load knowledge graph';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived: filtered nodes/edges
  const filteredNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return nodes.filter((n) => {
      if (subjectFilter !== 'all' && n.subjectId !== subjectFilter) return false;
      if (masteryFilter !== 'all' && n.masteryLevel !== masteryFilter) return false;
      if (q && !n.name.toLowerCase().includes(q) && !n.chapterName.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [nodes, subjectFilter, masteryFilter, searchQuery]);

  const filteredEdges = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [edges, filteredNodes]);

  const filteredChapters = useMemo(() => {
    if (subjectFilter === 'all') return chapters;
    return chapters.filter((c) => c.subjectId === subjectFilter);
  }, [chapters, subjectFilter]);

  // D3 render
  useEffect(() => {
    if (loading || viewMode !== 'graph') return;
    if (filteredNodes.length === 0 || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.max(560, container.clientHeight);

    const simNodes: SimNode[] = filteredNodes.map((n) => ({
      id: n.id,
      name: n.name,
      chapterId: n.chapterId,
      chapterName: n.chapterName,
      chapterColor: n.chapterColor,
      subjectName: n.subjectName,
      mastery: n.mastery,
      masteryLevel: n.masteryLevel,
      color: n.color,
      attempts: n.attempts,
    }));

    const simLinks: SimLink[] = filteredEdges.map((e) => ({
      source: e.source,
      target: e.target,
      relationType: e.relationType,
    }));

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Arrowhead marker
    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#94a3b8');

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    const radius = (n: SimNode) => Math.max(14, Math.min(34, 12 + n.attempts * 1.5));

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(110)
          .strength(0.4),
      )
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide<SimNode>().radius((d) => radius(d) + 8),
      )
      // Cluster topics by chapter — gentle attraction toward chapter centroid
      .force('cluster', (alpha: number) => {
        const groups = new Map<number, { x: number; y: number; count: number }>();
        for (const n of simNodes) {
          const entry = groups.get(n.chapterId) ?? { x: 0, y: 0, count: 0 };
          entry.x += n.x ?? 0;
          entry.y += n.y ?? 0;
          entry.count++;
          groups.set(n.chapterId, entry);
        }
        const centroids = new Map<number, { x: number; y: number }>();
        for (const [id, v] of groups) {
          centroids.set(id, { x: v.x / v.count, y: v.y / v.count });
        }
        const k = 0.06 * alpha;
        for (const n of simNodes) {
          const c = centroids.get(n.chapterId);
          if (!c) continue;
          n.vx = (n.vx ?? 0) + (c.x - (n.x ?? 0)) * k;
          n.vy = (n.vy ?? 0) + (c.y - (n.y ?? 0)) * k;
        }
      });

    const link = g
      .append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', showEdges ? 0.5 : 0)
      .attr('marker-end', showEdges ? 'url(#arrow)' : null);

    const nodeGroup = g
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    // Chapter ring (outer)
    nodeGroup
      .append('circle')
      .attr('r', (d) => radius(d) + 4)
      .attr('fill', 'none')
      .attr('stroke', (d) => d.chapterColor)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.55);

    // Mastery circle (inner)
    nodeGroup
      .append('circle')
      .attr('r', (d) => radius(d))
      .attr('fill', (d) => MASTERY_COLOR[d.color])
      .attr('fill-opacity', 0.9)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Mastery percent label inside the node
    nodeGroup
      .append('text')
      .text((d) => (d.attempts > 0 ? `${Math.round(d.mastery)}%` : '—'))
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-size', 10)
      .attr('font-weight', 700)
      .attr('fill', '#fff')
      .style('pointer-events', 'none');

    // Topic name below the node
    nodeGroup
      .append('text')
      .text((d) => (d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name))
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => radius(d) + 16)
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('fill', '#334155')
      .style('pointer-events', 'none');

    nodeGroup.append('title').text((d) => `${d.name}\nChapter: ${d.chapterName}\nMastery: ${d.attempts > 0 ? `${d.mastery}%` : 'Not attempted'}`);

    nodeGroup.on('click', (_event, d) => {
      setSelectedNode(d);
    });

    nodeGroup.on('mouseenter', function () {
      d3.select(this).select('circle:nth-child(2)').attr('stroke-width', 3.5);
    });
    nodeGroup.on('mouseleave', function () {
      d3.select(this).select('circle:nth-child(2)').attr('stroke-width', 2);
    });

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [loading, viewMode, filteredNodes, filteredEdges, showEdges]);

  // Reset selection when filters change to avoid stale references
  useEffect(() => {
    setSelectedNode(null);
  }, [subjectFilter, masteryFilter, searchQuery, viewMode]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, factor);
  };

  const handleZoomReset = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading knowledge graph…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader onBack={() => window.history.back()} onRefresh={fetchData} />

      {error && (
        <Card padding="sm" className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">Failed to load: {error}</p>
        </Card>
      )}

      {summary && <SummaryHero summary={summary} />}

      <FiltersBar
        subjects={subjects}
        subjectFilter={subjectFilter}
        onSubjectChange={setSubjectFilter}
        masteryFilter={masteryFilter}
        onMasteryChange={setMasteryFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showEdges={showEdges}
        onShowEdgesChange={setShowEdges}
        visibleCount={filteredNodes.length}
        totalCount={nodes.length}
        edgeCount={filteredEdges.length}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {/* Main panel */}
        <div className="xl:col-span-3 space-y-6">
          {viewMode === 'graph' ? (
            <GraphView
              ref={containerRef}
              svgRef={svgRef}
              hasNodes={filteredNodes.length > 0}
              onZoomIn={() => handleZoom(1.3)}
              onZoomOut={() => handleZoom(1 / 1.3)}
              onZoomReset={handleZoomReset}
            />
          ) : (
            <ChapterGridView
              chapters={filteredChapters}
              nodes={filteredNodes}
              onTopicClick={(n) => {
                const sim: SimNode = {
                  id: n.id,
                  name: n.name,
                  chapterId: n.chapterId,
                  chapterName: n.chapterName,
                  chapterColor: n.chapterColor,
                  subjectName: n.subjectName,
                  mastery: n.mastery,
                  masteryLevel: n.masteryLevel,
                  color: n.color,
                  attempts: n.attempts,
                };
                setSelectedNode(sim);
              }}
            />
          )}

          {recommendations && (
            <RecommendationsSection
              recommendations={recommendations}
              onPractice={() => navigate('/student/ai-practice')}
            />
          )}
        </div>

        {/* Detail side panel */}
        <div className="xl:col-span-1">
          <div className="sticky top-20 space-y-4">
            <DetailPanel
              node={selectedNode}
              onPractice={() => navigate('/student/ai-practice')}
            />
            <LegendCard />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────

function PageHeader({ onBack, onRefresh }: { onBack: () => void; onRefresh: () => void }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Knowledge Graph</h1>
        <p className="mt-1 text-sm text-slate-500">
          A visual map of every topic you've studied, color-coded by mastery and clustered by chapter.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function SummaryHero({ summary }: { summary: KnowledgeGraphSummary }) {
  const { totalTopics, attemptedTopics, strongCount, developingCount, weakCount, untouchedCount, overallMastery } = summary;
  const coverage = totalTopics > 0 ? Math.round((attemptedTopics / totalTopics) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Card padding="md" className="lg:col-span-2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-violet-50 pointer-events-none" />
        <div className="relative flex items-center gap-5">
          <MasteryGauge value={overallMastery} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Overall Mastery
            </p>
            <p className="text-3xl font-bold text-slate-900">{overallMastery.toFixed(1)}%</p>
            <p className="mt-1 text-sm text-slate-600">
              Across <span className="font-semibold">{attemptedTopics}</span> attempted topics ({coverage}% coverage)
            </p>
          </div>
        </div>
      </Card>

      <StatCard
        label="Strong"
        value={strongCount}
        color="text-emerald-600"
        bg="bg-emerald-50"
        ring="ring-emerald-200"
        hint="Mastery > 70%"
      />
      <StatCard
        label="Developing"
        value={developingCount}
        color="text-amber-600"
        bg="bg-amber-50"
        ring="ring-amber-200"
        hint="Mastery 40–70%"
      />
      <StatCard
        label="Needs Focus"
        value={weakCount + untouchedCount}
        color="text-red-600"
        bg="bg-red-50"
        ring="ring-red-200"
        hint={`${weakCount} weak · ${untouchedCount} not started`}
      />
    </div>
  );
}

function MasteryGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 70 ? '#10b981' : clamped >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 700ms ease, stroke 300ms' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold text-slate-900">{Math.round(clamped)}%</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  bg,
  ring,
  hint,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  ring: string;
  hint: string;
}) {
  return (
    <Card padding="md" className={`${bg} ring-1 ${ring} border-transparent`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </div>
    </Card>
  );
}

interface FiltersBarProps {
  subjects: KnowledgeGraphSubject[];
  subjectFilter: number | 'all';
  onSubjectChange: (v: number | 'all') => void;
  masteryFilter: MasteryFilter;
  onMasteryChange: (v: MasteryFilter) => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  showEdges: boolean;
  onShowEdgesChange: (v: boolean) => void;
  visibleCount: number;
  totalCount: number;
  edgeCount: number;
}

function FiltersBar(props: FiltersBarProps) {
  const masteryChips: Array<{ id: MasteryFilter; label: string; className: string }> = [
    { id: 'all', label: 'All', className: 'bg-slate-100 text-slate-700' },
    { id: 'strong', label: 'Strong', className: 'bg-emerald-100 text-emerald-700' },
    { id: 'developing', label: 'Developing', className: 'bg-amber-100 text-amber-700' },
    { id: 'weak', label: 'Weak', className: 'bg-red-100 text-red-700' },
    { id: 'untouched', label: 'Not started', className: 'bg-slate-100 text-slate-500' },
  ];

  return (
    <Card padding="sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Subject filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Subject
            </label>
            <select
              value={props.subjectFilter === 'all' ? 'all' : String(props.subjectFilter)}
              onChange={(e) =>
                props.onSubjectChange(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All subjects</option>
              {props.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mastery chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {masteryChips.map((m) => (
              <button
                key={m.id}
                onClick={() => props.onMasteryChange(m.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  props.masteryFilter === m.id
                    ? `${m.className} ring-2 ring-offset-1 ring-current`
                    : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.3-4.3M10 18a8 8 0 110-16 8 8 0 010 16z"
              />
            </svg>
            <input
              value={props.searchQuery}
              onChange={(e) => props.onSearchChange(e.target.value)}
              placeholder="Search topic or chapter…"
              className="w-56 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Edges toggle (only meaningful in graph mode) */}
          {props.viewMode === 'graph' && (
            <button
              onClick={() => props.onShowEdgesChange(!props.showEdges)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                props.showEdges
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
              title="Toggle prerequisite links"
            >
              {props.showEdges ? 'Hide links' : 'Show links'}
            </button>
          )}

          {/* View mode toggle */}
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
            <button
              onClick={() => props.onViewModeChange('graph')}
              className={`px-3 py-1.5 text-xs font-semibold ${
                props.viewMode === 'graph'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => props.onViewModeChange('chapters')}
              className={`px-3 py-1.5 text-xs font-semibold ${
                props.viewMode === 'chapters'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Chapters
            </button>
          </div>

          <span className="text-xs text-slate-500 whitespace-nowrap">
            {props.visibleCount} of {props.totalCount} topics
            {props.viewMode === 'graph' && ` · ${props.edgeCount} links`}
          </span>
        </div>
      </div>
    </Card>
  );
}

interface GraphViewProps {
  hasNodes: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  ref: React.RefObject<HTMLDivElement | null>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

function GraphView({ ref, svgRef, hasNodes, onZoomIn, onZoomOut, onZoomReset }: GraphViewProps) {
  return (
    <div
      ref={ref}
      className="relative rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      style={{ minHeight: 560 }}
    >
      {hasNodes ? (
        <>
          <svg ref={svgRef} className="w-full" />
          {/* Zoom controls */}
          <div className="absolute right-3 top-3 flex flex-col gap-1.5">
            <button
              onClick={onZoomIn}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50"
              title="Zoom in"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M6 12h12" />
              </svg>
            </button>
            <button
              onClick={onZoomOut}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50"
              title="Zoom out"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" />
              </svg>
            </button>
            <button
              onClick={onZoomReset}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50"
              title="Reset view"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l5 5M20 4l-5 5M4 20l5-5M20 20l-5-5" />
              </svg>
            </button>
          </div>
          <p className="absolute bottom-3 left-3 text-[11px] text-slate-400">
            Drag nodes · scroll to zoom · click to inspect
          </p>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center py-24 text-center">
          <svg
            className="mx-auto h-12 w-12 text-slate-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
            />
          </svg>
          <p className="mt-3 text-slate-500">
            No topics match the current filters. Try clearing them.
          </p>
        </div>
      )}
    </div>
  );
}

function ChapterGridView({
  chapters,
  nodes,
  onTopicClick,
}: {
  chapters: KnowledgeGraphChapter[];
  nodes: KnowledgeGraphNode[];
  onTopicClick: (n: KnowledgeGraphNode) => void;
}) {
  // Group filtered topics by chapter id
  const grouped = useMemo(() => {
    const map = new Map<number, KnowledgeGraphNode[]>();
    for (const n of nodes) {
      const arr = map.get(n.chapterId) ?? [];
      arr.push(n);
      map.set(n.chapterId, arr);
    }
    return map;
  }, [nodes]);

  const visibleChapters = chapters.filter((c) => (grouped.get(c.id)?.length ?? 0) > 0);

  if (visibleChapters.length === 0) {
    return (
      <Card padding="lg">
        <p className="py-8 text-center text-sm text-slate-500">
          No chapters match the current filters.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {visibleChapters.map((c) => {
        const topics = grouped.get(c.id) ?? [];
        return (
          <Card key={c.id} padding="md" className="relative overflow-hidden">
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{ backgroundColor: c.color }}
            />
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {c.subjectName}
                </p>
                <h3 className="text-base font-semibold text-slate-900">{c.name}</h3>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-900">{c.avgMastery.toFixed(0)}%</p>
                <p className="text-[11px] text-slate-500">
                  {c.attemptedCount}/{c.topicCount} attempted
                </p>
              </div>
            </div>

            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, c.avgMastery)}%`,
                  backgroundColor: c.color,
                }}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTopicClick(t)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  title={`${t.name} — ${t.attempts > 0 ? `${t.mastery}%` : 'Not attempted'}`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: MASTERY_COLOR[t.color] }}
                  />
                  <span className="truncate max-w-[140px]">{t.name}</span>
                </button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function RecommendationsSection({
  recommendations,
  onPractice,
}: {
  recommendations: KnowledgeGraphRecommendations;
  onPractice: () => void;
}) {
  const { nextToStudy, quickWins, keyPrerequisites } = recommendations;
  const hasAny =
    nextToStudy.length > 0 || quickWins.length > 0 || keyPrerequisites.length > 0;

  if (!hasAny) return null;

  return (
    <Card padding="md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900">Smart Recommendations</h3>
        </div>
        <Button variant="subtle" size="sm" onClick={onPractice}>
          Start AI Practice
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RecCard
          title="Focus next"
          tone="danger"
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          }
          items={nextToStudy}
          emptyMsg="No weak topics yet — keep practicing!"
        />
        <RecCard
          title="Quick wins"
          tone="warning"
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          }
          items={quickWins}
          emptyMsg="No close-to-mastery topics right now"
        />
        <RecCard
          title="Key prerequisites"
          tone="info"
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          }
          items={keyPrerequisites}
          emptyMsg="No prerequisites detected — graph not configured"
          showUnlocks
        />
      </div>
    </Card>
  );
}

function RecCard({
  title,
  tone,
  icon,
  items,
  emptyMsg,
  showUnlocks = false,
}: {
  title: string;
  tone: 'danger' | 'warning' | 'info';
  icon: React.ReactNode;
  items: KnowledgeGraphRecommendation[];
  emptyMsg: string;
  showUnlocks?: boolean;
}) {
  const toneClasses: Record<typeof tone, string> = {
    danger: 'bg-red-50 text-red-700 ring-red-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    info: 'bg-sky-50 text-sky-700 ring-sky-200',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ring-1 ${toneClasses[tone]}`}>
          {icon}
        </span>
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      </div>

      {items.length === 0 ? (
        <p className="py-2 text-xs text-slate-500">{emptyMsg}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.topicId}
              className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200/60 transition hover:ring-slate-300"
            >
              <p className="text-sm font-medium text-slate-900 line-clamp-1">{item.topicName}</p>
              <p className="text-[11px] text-slate-500 line-clamp-1">
                {item.subjectName} · {item.chapterName}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-600">
                  {item.mastery > 0 ? `${item.mastery}% mastery` : 'Not attempted'}
                </span>
                {showUnlocks && item.unlocks !== undefined && (
                  <Badge variant="info" size="sm">
                    Unlocks {item.unlocks}
                  </Badge>
                )}
                {!showUnlocks && item.attempts !== undefined && item.attempts > 0 && (
                  <span className="text-[11px] text-slate-500">{item.attempts} attempts</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetailPanel({
  node,
  onPractice,
}: {
  node: SimNode | null;
  onPractice: () => void;
}) {
  if (!node) {
    return (
      <Card padding="md">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg
            className="h-10 w-10 text-slate-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
            />
          </svg>
          <p className="mt-3 text-sm text-slate-500">
            Click any topic to see details, mastery progress, and study options.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="space-y-4">
        <div>
          <div
            className="mb-2 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1"
            style={{
              backgroundColor: `${node.chapterColor}15`,
              color: node.chapterColor,
              borderColor: node.chapterColor,
            }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: node.chapterColor }}
            />
            {node.chapterName}
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{node.name}</h3>
          <p className="text-xs text-slate-400">{node.subjectName}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-600">Mastery level</span>
            <Badge variant={MASTERY_BADGE[node.masteryLevel]}>
              {MASTERY_LABEL[node.masteryLevel]}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-600">Accuracy</span>
            <span className="text-sm font-semibold text-slate-900">
              {node.attempts > 0 ? `${node.mastery}%` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-600">Questions answered</span>
            <span className="text-sm font-semibold text-slate-900">{node.attempts}</span>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-500">Progress</span>
            <span className="font-semibold text-slate-700">{node.mastery}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${node.mastery}%`,
                backgroundColor: MASTERY_COLOR[node.color],
              }}
            />
          </div>
        </div>

        <Button variant="primary" size="sm" fullWidth onClick={onPractice}>
          Practice this topic
        </Button>
      </div>
    </Card>
  );
}

function LegendCard() {
  return (
    <Card padding="sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Legend
      </p>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-slate-600">Strong (&gt;70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          <span className="text-slate-600">Developing (40–70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-slate-600">Weak (&lt;40%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="text-slate-600">Not started</span>
        </div>
        <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          Outer ring = chapter color · node size = attempts
        </div>
      </div>
    </Card>
  );
}
