import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { KnowledgeGraphView } from '@/components/knowledge-graph/KnowledgeGraphView';
import { getChildren } from '@/services/parent.api';
import {
  getChildKnowledgeGraph,
  getChildLearningPath,
} from '@/services/knowledgeGraph.api';

export default function KnowledgeGraphPage() {
  const { data: children = [], isLoading: loadingChildren } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: getChildren,
    staleTime: 60_000,
  });

  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [subject, setSubject] = useState<number | 'all'>('all');

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].student.id);
    }
  }, [children, selectedChildId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['parent-knowledge-graph', selectedChildId],
    queryFn: () => getChildKnowledgeGraph(selectedChildId as number),
    enabled: selectedChildId != null,
  });

  const subjectOptions = useMemo(
    () => (data?.nodes ?? []).filter((n) => n.type === 'SUBJECT'),
    [data],
  );

  const nodes = useMemo(() => {
    const all = data?.nodes ?? [];
    return subject === 'all' ? all : all.filter((n) => n.subjectId === subject);
  }, [data, subject]);

  const recommendations = useMemo(() => {
    const recs = data?.recommendations ?? [];
    return subject === 'all' ? recs : recs.filter((r) => r.subjectId === subject);
  }, [data, subject]);

  const selectedChild = children.find((c) => c.student.id === selectedChildId);
  const childName = selectedChild?.student.fullName ?? 'your child';

  if (loadingChildren) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (children.length === 0) {
    return <NoChildrenView />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Knowledge Graph</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Track {childName}&apos;s strengths and weaknesses by subject, chapter, and skill.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children.length > 1 && (
            <select
              value={selectedChildId ?? ''}
              onChange={(e) => {
                setSelectedChildId(Number(e.target.value));
                setSubject('all');
              }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-secondary)] shadow-sm focus:border-[var(--color-primary)] focus:outline-none"
            >
              {children.map((child) => (
                <option key={child.student.id} value={child.student.id}>
                  {child.student.fullName ?? child.student.username}
                </option>
              ))}
            </select>
          )}
          {subjectOptions.length > 1 && (
            <select
              value={subject}
              onChange={(e) =>
                setSubject(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
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
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : isError ? (
        <Card>
          <p className="py-8 text-center text-sm text-[var(--color-danger)]">
            Failed to load the knowledge graph.
          </p>
        </Card>
      ) : (
        <KnowledgeGraphView
          nodes={nodes}
          recommendations={recommendations}
          fetchLearningPath={(nodeId) => getChildLearningPath(selectedChildId as number, nodeId)}
          pathQueryKey={(nodeId) => ['parent-learning-path', selectedChildId, nodeId]}
          recommendationsTitle="Suggested focus areas"
          recommendationsSubtitle={`Where ${childName} would benefit most — prioritised by prerequisite gaps, then weakest areas.`}
          emptyState={
            <Card>
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  No mastery data yet
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Once {childName} takes and submits an exam, this knowledge graph fills in
                  automatically.
                </p>
              </div>
            </Card>
          }
        />
      )}
    </div>
  );
}

function NoChildrenView() {
  return (
    <div className="mx-auto max-w-lg py-12">
      <Card padding="lg">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Student profile not found</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your parent account is linked directly to a student account. Please contact a teacher or
            administrator if you don&apos;t see any data.
          </p>
        </div>
      </Card>
    </div>
  );
}
