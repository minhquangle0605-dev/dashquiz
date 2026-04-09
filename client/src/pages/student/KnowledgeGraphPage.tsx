import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import {
  getStudentKnowledgeGraph,
  getStudentStrengths,
  type KnowledgeGraphNode,
  type KnowledgeGraphEdge,
  type StrengthItem,
} from '@/services/analytics.api';

interface SimNode extends d3.SimulationNodeDatum {
  id: number;
  name: string;
  chapterName: string;
  subjectName: string;
  mastery: number;
  masteryLevel: string;
  color: string;
  attempts?: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  relationType: string;
}

export default function KnowledgeGraphPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<KnowledgeGraphNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeGraphEdge[]>([]);
  const [strengths, setStrengths] = useState<StrengthItem[]>([]);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [graphData, strengthData] = await Promise.allSettled([
        getStudentKnowledgeGraph(),
        getStudentStrengths(),
      ]);

      if (graphData.status === 'fulfilled') {
        setNodes(graphData.value.nodes);
        setEdges(graphData.value.edges);
      }
      if (strengthData.status === 'fulfilled') {
        setStrengths(strengthData.value);
      }
    } catch {
      // remain empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (loading || nodes.length === 0 || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.max(500, container.clientHeight);

    const strengthMap = new Map<number, StrengthItem>();
    for (const s of strengths) {
      strengthMap.set(s.topicId, s);
    }

    const simNodes: SimNode[] = nodes.map((n) => ({
      id: n.id,
      name: n.name,
      chapterName: n.chapterName,
      subjectName: n.subjectName,
      mastery: n.mastery,
      masteryLevel: n.masteryLevel,
      color: n.color,
      attempts: strengthMap.get(n.id)?.totalQuestions ?? 0,
    }));

    const nodeIdSet = new Set(simNodes.map((n) => n.id));
    const simLinks: SimLink[] = edges
      .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        relationType: e.relationType,
      }));

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const colorMap: Record<string, string> = {
      red: '#ef4444',
      yellow: '#f59e0b',
      green: '#10b981',
    };

    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    const link = g.append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    const nodeGroup = g.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, SimNode>()
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

    nodeGroup.append('circle')
      .attr('r', (d) => Math.max(16, Math.min(32, 12 + (d.attempts ?? 0) * 1.5)))
      .attr('fill', (d) => colorMap[d.color] ?? '#94a3b8')
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2.5);

    nodeGroup.append('text')
      .text((d) => d.name.length > 16 ? d.name.slice(0, 14) + '...' : d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => Math.max(16, Math.min(32, 12 + (d.attempts ?? 0) * 1.5)) + 14)
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('fill', '#334155');

    nodeGroup.on('click', (_event, d) => {
      setSelectedNode(d);
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
  }, [loading, nodes, edges, strengths]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading knowledge graph...</p>
        </div>
      </div>
    );
  }

  const selectedStrength = selectedNode ? strengths.find((s) => s.topicId === selectedNode.id) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Knowledge Graph</h1>
          <p className="mt-1 text-sm text-slate-500">
            Visual map of topics and your mastery level. Larger nodes = more attempts.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          Back
        </Button>
      </div>

      {/* Legend */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-slate-700">Mastery:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500" /> Strong (&gt;70%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-500" /> Developing (40-70%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500" /> Weak (&lt;40%)
          </span>
          <span className="ml-auto text-slate-400">
            {nodes.length} topics &middot; {edges.length} connections
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Graph area */}
        <div
          ref={containerRef}
          className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
          style={{ minHeight: 500 }}
        >
          {nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-24 text-center">
              <svg className="mx-auto h-12 w-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <p className="mt-3 text-slate-500">No topic data available. Complete some exams to see your knowledge graph.</p>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full" />
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-1">
          <Card padding="md" className="sticky top-20">
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedNode.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedNode.chapterName}</p>
                  <p className="text-xs text-slate-400">{selectedNode.subjectName}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-600">Mastery</span>
                    <Badge
                      variant={
                        selectedNode.masteryLevel === 'strong'
                          ? 'success'
                          : selectedNode.masteryLevel === 'developing'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {selectedNode.mastery}%
                    </Badge>
                  </div>

                  {selectedStrength && (
                    <>
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-sm text-slate-600">Accuracy</span>
                        <span className="text-sm font-semibold text-slate-900">{selectedStrength.accuracy}%</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-sm text-slate-600">Correct</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {selectedStrength.correctCount}/{selectedStrength.totalQuestions}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-600">Attempts</span>
                    <span className="text-sm font-semibold text-slate-900">{selectedNode.attempts ?? 0}</span>
                  </div>
                </div>

                {/* Mastery progress bar */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-semibold text-slate-700">{selectedNode.mastery}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedNode.masteryLevel === 'strong'
                          ? 'bg-emerald-500'
                          : selectedNode.masteryLevel === 'developing'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${selectedNode.mastery}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
                </svg>
                <p className="mt-3 text-sm text-slate-500">Click a node to view topic details</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
