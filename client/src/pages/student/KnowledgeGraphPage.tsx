import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { KnowledgeGraphView } from '@/components/knowledge-graph/KnowledgeGraphView';
import {
  generatePracticeFromNode,
  getMyKnowledgeGraph,
  getMyLearningPath,
} from '@/services/knowledgeGraph.api';

export default function KnowledgeGraphPage() {
  const navigate = useNavigate();
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

  const recommendations = useMemo(() => {
    const recs = data?.recommendations ?? [];
    return subject === 'all' ? recs : recs.filter((r) => r.subjectId === subject);
  }, [data, subject]);

  const practice = useMutation({
    mutationFn: (nodeId: number) => generatePracticeFromNode(nodeId),
    onSuccess: (r) => {
      toast.success(`Generated a ${r.totalQuestions}-question practice set`);
      navigate(`/student/exams/${r.examId}/take`);
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'No questions available for this skill yet',
      ),
  });

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

      <KnowledgeGraphView
        nodes={nodes}
        recommendations={recommendations}
        fetchLearningPath={getMyLearningPath}
        pathQueryKey={(nodeId) => ['student-learning-path', nodeId]}
        practice={{ onGenerate: (id) => practice.mutate(id), pendingNodeId: practice.isPending ? practice.variables ?? null : null }}
        emptyState={
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
        }
      />
    </div>
  );
}
