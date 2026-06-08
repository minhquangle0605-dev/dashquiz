import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import {
  addNodeAlias,
  autogenerateKnowledgeNodes,
  createKnowledgeRelation,
  deleteKnowledgeNode,
  deleteKnowledgeRelation,
  deleteNodeAlias,
  getAdminKnowledgeNodes,
  getKnowledgeRelations,
  getNodeAliases,
  getQualityReport,
  mergeKnowledgeNode,
  recalculateAllMastery,
  seedPartOfRelations,
  updateKnowledgeNode,
  type AdminKnowledgeNode,
  type RelationType,
} from '@/services/knowledgeGraph.api';

const RELATION_TYPES: { value: RelationType; label: string }[] = [
  { value: 'PREREQUISITE_OF', label: 'is prerequisite of' },
  { value: 'RELATED_TO', label: 'is related to' },
  { value: 'MISCONCEPTION_FOR', label: 'is a misconception for' },
  { value: 'PART_OF', label: 'is part of' },
];

const TYPE_BADGE: Record<string, string> = {
  SUBJECT: 'bg-indigo-100 text-indigo-700',
  CHAPTER: 'bg-sky-100 text-sky-700',
  SKILL: 'bg-violet-100 text-violet-700',
  SUBSKILL: 'bg-slate-100 text-slate-600',
};

export default function KnowledgeNodesPage() {
  const queryClient = useQueryClient();
  const { data: nodes, isLoading } = useQuery({
    queryKey: ['admin-knowledge-nodes'],
    queryFn: () => getAdminKnowledgeNodes(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-knowledge-nodes'] });

  const autogen = useMutation({
    mutationFn: autogenerateKnowledgeNodes,
    onSuccess: (r) => {
      toast.success(
        `Generated ${r.subjects} subjects, ${r.chapters} chapters, ${r.skills} skills (${r.links} links)`,
      );
      invalidate();
    },
    onError: () => toast.error('Failed to generate knowledge nodes'),
  });

  const recalc = useMutation({
    mutationFn: recalculateAllMastery,
    onSuccess: (r) => toast.success(`Recalculated mastery for ${r.students} student(s)`),
    onError: () => toast.error('Failed to recalculate mastery'),
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => updateKnowledgeNode(id, { name }),
    onSuccess: () => {
      toast.success('Node updated');
      invalidate();
    },
    onError: () => toast.error('Failed to update node'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteKnowledgeNode(id),
    onSuccess: () => {
      toast.success('Node deleted');
      invalidate();
    },
    onError: () => toast.error('Failed to delete node'),
  });

  const childrenOf = useMemo(() => {
    const map = new Map<number | null, AdminKnowledgeNode[]>();
    for (const n of nodes ?? []) {
      if (!map.has(n.parentId)) map.set(n.parentId, []);
      map.get(n.parentId)!.push(n);
    }
    return map;
  }, [nodes]);

  const nodeIds = useMemo(() => new Set((nodes ?? []).map((n) => n.id)), [nodes]);
  const roots = useMemo(
    () => (nodes ?? []).filter((n) => n.parentId == null || !nodeIds.has(n.parentId)),
    [nodes, nodeIds],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Knowledge Nodes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage the knowledge tree generated from subjects, chapters, and tags.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => recalc.mutate()}
            disabled={recalc.isPending}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {recalc.isPending ? 'Recalculating…' : 'Recalculate mastery'}
          </button>
          <button
            type="button"
            onClick={() => autogen.mutate()}
            disabled={autogen.isPending}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {autogen.isPending ? 'Generating…' : 'Auto-generate'}
          </button>
        </div>
      </div>

      <Card padding="sm" variant="soft">
        <p className="text-xs text-slate-500">
          <strong>Auto-generate</strong> rebuilds nodes + question links from the current question
          bank (safe to re-run). <strong>Recalculate mastery</strong> backfills student scores from
          all submitted attempts — run it once after the first generation.
        </p>
      </Card>

      <QualityDashboard />

      <Card title={`Knowledge tree${nodes ? ` · ${nodes.length} nodes` : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : roots.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No knowledge nodes yet. Click <strong>Auto-generate</strong> to build them.
          </p>
        ) : (
          <div className="space-y-1">
            {roots.map((r) => (
              <NodeRow
                key={r.id}
                node={r}
                childrenOf={childrenOf}
                depth={0}
                onRename={(id, name) => rename.mutate({ id, name })}
                onDelete={(id) => remove.mutate(id)}
              />
            ))}
          </div>
        )}
      </Card>

      <RelationsPanel nodes={nodes ?? []} />

      <MergePanel nodes={nodes ?? []} />
    </div>
  );
}

// ─── Quality dashboard (Package C) ─────────────────

function QualityDashboard() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-kg-quality'],
    queryFn: getQualityReport,
  });

  return (
    <Card
      title="Taxonomy quality"
      subtitle="Coverage and data-quality checks for the knowledge graph (PDF §11/§16)."
    >
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Coverage" value={`${data.totals.coverage}%`} tone="primary" />
            <Metric
              label="Mapped questions"
              value={`${data.totals.mappedQuestions}/${data.totals.questions}`}
            />
            <Metric label="Nodes" value={String(data.totals.nodes)} />
            <Metric label="Relations" value={String(data.totals.relations)} />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <IssueCard
              label="Unmapped questions"
              count={data.unmappedQuestions.count}
              items={data.unmappedQuestions.sample.map((q) => `#${q.id} · ${q.content}`)}
            />
            <IssueCard
              label="Orphan skill nodes"
              count={data.orphanNodes.count}
              items={data.orphanNodes.sample.map((n) => `[${n.type}] ${n.name}`)}
            />
            <IssueCard
              label="Duplicate candidates"
              count={data.duplicateCandidates.length}
              items={data.duplicateCandidates.map(
                (d) => `"${d.name}" → nodes ${d.nodeIds.join(', ')}`,
              )}
            />
            <IssueCard
              label="Over-mapped questions (>3 skills)"
              count={data.overMappedQuestions.count}
              items={data.overMappedQuestions.sample.map(
                (q) => `#${q.questionId} · ${q.skillCount} skills`,
              )}
            />
            <IssueCard
              label="Thin skills (<5 questions)"
              count={data.thinSkillNodes.count}
              items={data.thinSkillNodes.sample.map((n) => `${n.name} · ${n.questionCount} q`)}
            />
            <IssueCard
              label="Low-confidence / pending mappings"
              count={data.lowConfidenceMappings}
              items={[]}
            />
          </div>
        </>
      )}
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'primary' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`text-lg font-bold ${tone === 'primary' ? 'text-indigo-600' : 'text-slate-800'}`}
      >
        {value}
      </p>
    </div>
  );
}

function IssueCard({ label, count, items }: { label: string; count: number; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            count === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {count}
        </span>
      </div>
      {items.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {items.slice(0, 5).map((it, i) => (
            <li key={i} className="truncate text-[11px] text-slate-500" title={it}>
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Merge panel (Package C) ───────────────────────

function MergePanel({ nodes }: { nodes: AdminKnowledgeNode[] }) {
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = useState<number | ''>('');
  const [targetId, setTargetId] = useState<number | ''>('');

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)),
    [nodes],
  );

  const merge = useMutation({
    mutationFn: () => mergeKnowledgeNode(Number(sourceId), Number(targetId)),
    onSuccess: () => {
      toast.success('Nodes merged. Run "Recalculate mastery" to refresh scores.');
      setSourceId('');
      setTargetId('');
      queryClient.invalidateQueries({ queryKey: ['admin-knowledge-nodes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-knowledge-relations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-kg-quality'] });
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to merge nodes',
      ),
  });

  const canMerge = sourceId !== '' && targetId !== '' && sourceId !== targetId;
  const sourceName = nodes.find((n) => n.id === sourceId)?.name;
  const targetName = nodes.find((n) => n.id === targetId)?.name;

  return (
    <Card
      title="Merge duplicate nodes"
      subtitle="Move all questions, aliases, and relations from one node into another, then delete the source."
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value === '' ? '' : Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">Source node (removed)…</option>
          {sortedNodes.map((n) => (
            <option key={n.id} value={n.id}>
              [{n.type}] {n.name} ({n.questionCount}q)
            </option>
          ))}
        </select>
        <span className="self-center text-center text-xs text-slate-400">merge into →</span>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value === '' ? '' : Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">Target node (kept)…</option>
          {sortedNodes.map((n) => (
            <option key={n.id} value={n.id}>
              [{n.type}] {n.name} ({n.questionCount}q)
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Merge "${sourceName}" into "${targetName}"? The source is deleted.`)) {
              merge.mutate();
            }
          }}
          disabled={!canMerge || merge.isPending}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {merge.isPending ? 'Merging…' : 'Merge'}
        </button>
      </div>
    </Card>
  );
}

// ─── Relations panel (Package B) ───────────────────

function RelationsPanel({ nodes }: { nodes: AdminKnowledgeNode[] }) {
  const queryClient = useQueryClient();
  const { data: relations, isLoading } = useQuery({
    queryKey: ['admin-knowledge-relations'],
    queryFn: () => getKnowledgeRelations(),
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-knowledge-relations'] });

  const [fromId, setFromId] = useState<number | ''>('');
  const [toId, setToId] = useState<number | ''>('');
  const [relType, setRelType] = useState<RelationType>('PREREQUISITE_OF');
  const [note, setNote] = useState('');

  const create = useMutation({
    mutationFn: () =>
      createKnowledgeRelation({
        fromNodeId: Number(fromId),
        toNodeId: Number(toId),
        relationType: relType,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Relation added');
      setNote('');
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to add relation',
      ),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteKnowledgeRelation(id),
    onSuccess: () => {
      toast.success('Relation removed');
      invalidate();
    },
    onError: () => toast.error('Failed to remove relation'),
  });

  const seed = useMutation({
    mutationFn: seedPartOfRelations,
    onSuccess: (r) => {
      toast.success(`Seeded ${r.created} PART_OF relation(s)`);
      invalidate();
    },
    onError: () => toast.error('Failed to seed relations'),
  });

  const sortedNodes = useMemo(
    () =>
      [...nodes].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)),
    [nodes],
  );
  const canAdd = fromId !== '' && toId !== '' && fromId !== toId;
  const relLabel = (t: RelationType) => RELATION_TYPES.find((r) => r.value === t)?.label ?? t;

  return (
    <Card
      title="Relations"
      subtitle="Prerequisites, related skills, and misconceptions power student recommendations & learning paths."
    >
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {seed.isPending ? 'Seeding…' : 'Seed PART_OF from tree'}
        </button>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_auto_1fr_auto]">
        <select
          value={fromId}
          onChange={(e) => setFromId(e.target.value === '' ? '' : Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">Select node…</option>
          {sortedNodes.map((n) => (
            <option key={n.id} value={n.id}>
              [{n.type}] {n.name}
            </option>
          ))}
        </select>
        <select
          value={relType}
          onChange={(e) => setRelType(e.target.value as RelationType)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none"
        >
          {RELATION_TYPES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={toId}
          onChange={(e) => setToId(e.target.value === '' ? '' : Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">Select node…</option>
          {sortedNodes.map((n) => (
            <option key={n.id} value={n.id}>
              [{n.type}] {n.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={!canAdd || create.isPending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Add
        </button>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (provenance / rationale)"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none sm:col-span-4"
        />
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner />
          </div>
        ) : !relations || relations.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            No relations yet. Add a prerequisite above, or seed PART_OF from the tree.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {relations.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="truncate font-medium text-slate-800">{r.fromName}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {relLabel(r.relationType)}
                </span>
                <span className="truncate font-medium text-slate-800">{r.toName}</span>
                {r.source !== 'manual' && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {r.source}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove.mutate(r.id)}
                  className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-rose-500 hover:bg-rose-100"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function NodeRow({
  node,
  childrenOf,
  depth,
  onRename,
  onDelete,
}: {
  node: AdminKnowledgeNode;
  childrenOf: Map<number | null, AdminKnowledgeNode[]>;
  depth: number;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const kids = childrenOf.get(node.id) ?? [];
  const hasKids = kids.length > 0;
  const [open, setOpen] = useState(depth < 1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.name);
  const [showAliases, setShowAliases] = useState(false);
  const [aliasDraft, setAliasDraft] = useState('');
  const queryClient = useQueryClient();

  const { data: aliases } = useQuery({
    queryKey: ['admin-node-aliases', node.id],
    queryFn: () => getNodeAliases(node.id),
    enabled: showAliases,
  });
  const refreshAliases = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-node-aliases', node.id] });
    queryClient.invalidateQueries({ queryKey: ['admin-knowledge-nodes'] });
  };
  const addAlias = useMutation({
    mutationFn: () => addNodeAlias(node.id, aliasDraft.trim()),
    onSuccess: () => {
      setAliasDraft('');
      refreshAliases();
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to add alias',
      ),
  });
  const removeAlias = useMutation({
    mutationFn: (aliasId: number) => deleteNodeAlias(aliasId),
    onSuccess: refreshAliases,
    onError: () => toast.error('Failed to remove alias'),
  });

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== node.name) onRename(node.id, trimmed);
    setEditing(false);
  };

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => hasKids && setOpen((o) => !o)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 ${
            hasKids ? 'hover:bg-slate-200 hover:text-slate-600' : 'opacity-0'
          }`}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {hasKids ? (open ? '▾' : '▸') : ''}
        </button>

        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_BADGE[node.type] ?? 'bg-slate-100 text-slate-600'}`}
        >
          {node.type}
        </span>

        {editing ? (
          <input
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={save}
            className="flex-1 rounded border border-indigo-300 px-2 py-0.5 text-sm focus:outline-none"
          />
        ) : (
          <span className="flex-1 truncate text-sm font-medium text-slate-800">{node.name}</span>
        )}

        <span className="shrink-0 text-[11px] text-slate-400">{node.questionCount} q</span>
        {node.aliasCount > 0 && (
          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
            {node.aliasCount} alias
          </span>
        )}

        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setShowAliases((s) => !s)}
            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200"
          >
            Aliases
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(node.name);
              setEditing(true);
            }}
            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete "${node.name}"? This also removes its mastery data.`)) {
                onDelete(node.id);
              }
            }}
            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-rose-500 hover:bg-rose-100"
          >
            Delete
          </button>
        </div>
      </div>

      {showAliases && (
        <div
          className="mb-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          style={{ marginLeft: `${depth * 18 + 34}px` }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {(aliases ?? []).map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200"
              >
                {a.alias}
                <button
                  type="button"
                  onClick={() => removeAlias.mutate(a.id)}
                  className="text-slate-400 hover:text-rose-500"
                  aria-label="Remove alias"
                >
                  ×
                </button>
              </span>
            ))}
            {(aliases ?? []).length === 0 && (
              <span className="text-[11px] text-slate-400">No aliases yet.</span>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={aliasDraft}
              onChange={(e) => setAliasDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && aliasDraft.trim()) addAlias.mutate();
              }}
              placeholder="Add synonym / tag variant…"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none"
            />
            <button
              type="button"
              onClick={() => addAlias.mutate()}
              disabled={!aliasDraft.trim() || addAlias.isPending}
              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {open && hasKids && (
        <div>
          {kids.map((k) => (
            <NodeRow
              key={k.id}
              node={k}
              childrenOf={childrenOf}
              depth={depth + 1}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
