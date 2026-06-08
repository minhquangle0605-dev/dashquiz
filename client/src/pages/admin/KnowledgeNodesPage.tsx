import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import {
  autogenerateKnowledgeNodes,
  deleteKnowledgeNode,
  getAdminKnowledgeNodes,
  recalculateAllMastery,
  updateKnowledgeNode,
  type AdminKnowledgeNode,
} from '@/services/knowledgeGraph.api';

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
    </div>
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

        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
