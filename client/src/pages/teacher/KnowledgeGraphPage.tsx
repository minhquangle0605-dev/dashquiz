import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { getTeacherClasses } from '@/services/analytics.api';
import {
  assignClassPractice,
  getClassKnowledgeGraph,
  getClassWeakNodes,
  getStudentKnowledgeGraph,
} from '@/services/knowledgeGraph.api';
import {
  LEVEL_BADGE,
  LEVEL_HEX,
  LEVEL_LABEL,
  LEVEL_ORDER,
  LEVEL_SWATCH,
  levelFromScore,
} from '@/utils/knowledgeGraph';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const AXIS_COLOR = '#94a3b8';
const GRID_COLOR = 'rgba(148, 163, 184, 0.18)';
const LABEL_COLOR = '#64748b';

export default function KnowledgeGraphPage() {
  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['teacher-kg-classes'],
    queryFn: getTeacherClasses,
  });

  const [classId, setClassId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);

  // Default to first class once loaded.
  useEffect(() => {
    if (classId == null && classes && classes.length > 0) setClassId(classes[0].id);
  }, [classes, classId]);

  const { data: graph, isLoading: graphLoading } = useQuery({
    queryKey: ['teacher-kg-class', classId],
    queryFn: () => getClassKnowledgeGraph(classId as number),
    enabled: classId != null,
  });

  const { data: weakNodes } = useQuery({
    queryKey: ['teacher-kg-weak', classId],
    queryFn: () => getClassWeakNodes(classId as number),
    enabled: classId != null,
  });

  const { data: studentGraph, isLoading: studentLoading } = useQuery({
    queryKey: ['teacher-kg-student', studentId],
    queryFn: () => getStudentKnowledgeGraph(studentId as number),
    enabled: studentId != null,
  });

  const assign = useMutation({
    mutationFn: (nodeId: number) => assignClassPractice(classId as number, nodeId),
    onSuccess: (r) =>
      toast.success(`Assigned "${r.title}" (${r.totalQuestions} questions) to the class`),
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to assign practice',
      ),
  });

  const cellMap = useMemo(() => {
    const map = new Map<string, { masteryScore: number; weaknessLevel: string; attemptCount: number }>();
    for (const c of graph?.cells ?? []) {
      map.set(`${c.studentId}:${c.nodeId}`, c);
    }
    return map;
  }, [graph]);

  const weakChart = useMemo(() => {
    const top = (weakNodes ?? []).slice(0, 10);
    if (top.length === 0) return null;
    return {
      data: {
        labels: top.map((n) => truncate(n.name, 24)),
        datasets: [
          {
            label: 'Avg mastery',
            data: top.map((n) => Math.round(n.avgMastery)),
            backgroundColor: top.map(
              (n) => LEVEL_HEX[levelFromScore(n.avgMastery, n.studentsWithData)],
            ),
            borderRadius: 6,
            maxBarThickness: 28,
          },
        ],
      },
      height: Math.max(180, top.length * 34),
    };
  }, [weakNodes]);

  if (classesLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!classes || classes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            You have no classes yet. Create a class to see its knowledge graph.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Class Knowledge Graph
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            See which chapters and skills your class is weakest in.
          </p>
        </div>
        <select
          value={classId ?? ''}
          onChange={(e) => {
            setClassId(Number(e.target.value));
            setStudentId(null);
          }}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-secondary)] shadow-sm focus:border-[var(--color-primary)] focus:outline-none"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.subjectName ? ` · ${c.subjectName}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Top weak nodes */}
      <Card title="Weakest areas in this class" subtitle="Lowest average mastery, colored by level.">
        {!weakChart ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
            No mastery data for this class yet.
          </p>
        ) : (
          <>
            <div style={{ height: weakChart.height }}>
              <Bar data={weakChart.data} options={horizontalBarOptions} />
            </div>
            <LevelLegend />
          </>
        )}
      </Card>

      {/* Assign targeted practice from weak nodes */}
      {weakNodes && weakNodes.length > 0 && (
        <Card
          title="Assign targeted practice"
          subtitle="Create a practice set from a weak area and assign it to this class."
        >
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {weakNodes.slice(0, 8).map((n) => {
              const lvl = levelFromScore(n.avgMastery, n.studentsWithData);
              return (
                <li key={n.nodeId} className="flex items-center gap-3 py-2">
                  <span
                    className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-secondary)]"
                    title={n.name}
                  >
                    {n.name}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEVEL_BADGE[lvl]}`}
                  >
                    {Math.round(n.avgMastery)}% avg
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-[var(--color-text-muted)] sm:inline">
                    {n.weakStudents} weak / {n.studentsWithData} measured
                  </span>
                  <button
                    type="button"
                    onClick={() => assign.mutate(n.nodeId)}
                    disabled={assign.isPending}
                    className="shrink-0 rounded-lg border border-[var(--color-primary-soft-strong)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] disabled:opacity-50"
                  >
                    {assign.isPending && assign.variables === n.nodeId ? 'Assigning…' : 'Assign practice'}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Heatmap */}
      <Card title="Mastery heatmap" subtitle="Students × chapters. Click a student to drill in.">
        {graphLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : !graph || graph.students.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
            No enrolled students.
          </p>
        ) : graph.nodes.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
            No chapters found for this subject. Ask an admin to generate knowledge nodes.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-[var(--color-bg-card)] px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)]">
                      Student
                    </th>
                    {graph.nodes.map((n) => (
                      <th
                        key={n.id}
                        className="px-1 py-2 text-center text-[11px] font-medium text-[var(--color-text-muted)]"
                        title={n.name}
                      >
                        <div className="mx-auto w-10 truncate">{n.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {graph.students.map((s) => (
                    <tr key={s.id}>
                      <td
                        className={`sticky left-0 z-10 cursor-pointer bg-[var(--color-bg-card)] px-3 py-1.5 text-left text-xs font-medium hover:underline ${
                          studentId === s.id
                            ? 'text-[var(--color-primary)]'
                            : 'text-[var(--color-text-secondary)]'
                        }`}
                        onClick={() => setStudentId(studentId === s.id ? null : s.id)}
                      >
                        {s.fullName}
                      </td>
                      {graph.nodes.map((n) => {
                        const cell = cellMap.get(`${s.id}:${n.id}`);
                        const lvl = cell
                          ? levelFromScore(cell.masteryScore, cell.attemptCount)
                          : 'unknown';
                        return (
                          <td key={n.id} className="px-1 py-1">
                            <div
                              className={`mx-auto flex h-7 w-10 items-center justify-center rounded text-[10px] font-semibold text-white ${LEVEL_SWATCH[lvl]}`}
                              title={
                                cell
                                  ? `${n.name}: ${cell.masteryScore}% (${cell.attemptCount} ans)`
                                  : `${n.name}: no data`
                              }
                            >
                              {cell ? Math.round(cell.masteryScore) : ''}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <LevelLegend />
          </>
        )}
      </Card>

      {/* Student drill-down */}
      {studentId != null && (
        <Card title={`Student detail${studentGraph ? ` · ${studentGraph.student.fullName}` : ''}`}>
          {studentLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : !studentGraph ? (
            <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">No data.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-muted)]">
                Overall mastery:{' '}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {studentGraph.summary.overallMastery}%
                </span>
              </p>
              {studentGraph.nodes
                .filter((n) => (n.type === 'CHAPTER' || n.type === 'SKILL') && n.attemptCount > 0)
                .sort((a, b) => a.masteryScore - b.masteryScore)
                .slice(0, 15)
                .map((n) => (
                  <div key={n.id} className="flex items-center gap-3">
                    <span
                      className="w-44 shrink-0 truncate text-sm text-[var(--color-text-secondary)]"
                      title={n.name}
                    >
                      {n.name}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
                      <div
                        className={`h-full rounded-full ${LEVEL_SWATCH[n.weaknessLevel]}`}
                        style={{ width: `${n.masteryScore}%` }}
                      />
                    </div>
                    <span
                      className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold ${LEVEL_BADGE[n.weaknessLevel]}`}
                    >
                      {LEVEL_LABEL[n.weaknessLevel]}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function LevelLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {LEVEL_ORDER.map((l) => (
        <span key={l} className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_HEX[l] }} />
          {LEVEL_LABEL[l]}
        </span>
      ))}
    </div>
  );
}

const horizontalBarOptions = {
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

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
