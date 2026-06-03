import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/authStore';
import { ROLES } from '@/utils/constants';
import {
  createDiscussion,
  createReply,
  deleteDiscussion,
  deleteReply,
  getDiscussionAttachmentUrl,
  getDiscussion,
  listDiscussions,
  updateDiscussion,
  updateReply,
} from '@/services/discussion.api';
import { listClasses, listMyClasses } from '@/services/class.api';
import type {
  Discussion,
  DiscussionAttachment,
  DiscussionReply,
  DiscussionScope,
  DiscussionType,
  ListDiscussionsParams,
} from '@/types/discussion';
import type { ClassItem } from '@/types/exam';

interface DiscussionsPanelProps {
  /** When true, shows extra metadata columns (creator, class, scope) — admin mode. */
  adminMode?: boolean;
}

type TabKey = 'announcement' | 'discussion';
type ScopeFilter = 'all' | 'global' | 'class';
type DraftLink = { url: string; title?: string };

const MAX_ATTACHMENTS = 5;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-US');
}

function authorName(d: { fullName: string | null; username: string }): string {
  return d.fullName || d.username;
}

function authorInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentLabel(attachment: DiscussionAttachment): string {
  if (attachment.title) return attachment.title;
  if (attachment.fileName) return attachment.fileName;
  return attachment.type === 'LINK' ? attachment.url : 'Attachment';
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function RoleBadge({ role }: { role: string }) {
  const r = role.toUpperCase();
  if (r === 'ADMIN') return <Badge variant="danger" size="sm">Admin</Badge>;
  if (r === 'TEACHER') return <Badge variant="brand" size="sm">Teacher</Badge>;
  if (r === 'STUDENT') return <Badge variant="info" size="sm">Student</Badge>;
  return <Badge variant="neutral" size="sm">{r}</Badge>;
}

function AttachmentComposer({
  prefix,
  linkInput,
  setLinkInput,
  onAddLink,
  links,
  onRemoveLink,
  files,
  onAddFiles,
  onRemoveFile,
}: {
  prefix: string;
  linkInput: string;
  setLinkInput: (value: string) => void;
  onAddLink: () => void;
  links: DraftLink[];
  onRemoveLink: (index: number) => void;
  files: File[];
  onAddFiles: (files: FileList | null) => void;
  onRemoveFile: (index: number) => void;
}) {
  const canAddFiles = files.length < MAX_ATTACHMENTS;

  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 gap-2">
          <Input
            placeholder="Paste a link..."
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            className="text-sm"
          />
          <Button variant="outline" size="sm" onClick={onAddLink} disabled={!linkInput.trim()}>
            Link
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'file', label: 'File', accept: undefined },
            { key: 'image', label: 'Image', accept: 'image/*' },
            { key: 'video', label: 'Video', accept: 'video/*' },
          ].map((item) => (
            <label
              key={item.key}
              htmlFor={`${prefix}-${item.key}`}
              className={`inline-flex cursor-pointer items-center rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium transition-colors ${
                canAddFiles
                  ? 'hover:bg-[var(--color-bg-muted)]'
                  : 'pointer-events-none opacity-50'
              }`}
            >
              {item.label}
              <input
                id={`${prefix}-${item.key}`}
                type="file"
                multiple
                accept={item.accept}
                className="hidden"
                disabled={!canAddFiles}
                onChange={(e) => {
                  onAddFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          ))}
        </div>
      </div>

      {(links.length > 0 || files.length > 0) && (
        <div className="mt-3 flex flex-col gap-2 text-xs">
          {links.map((link, index) => (
            <div
              key={`${link.url}-${index}`}
              className="flex items-center gap-2 rounded-md bg-[var(--color-bg-card)] px-2 py-1.5"
            >
              <span className="font-semibold text-[var(--color-primary)]">Link</span>
              <span className="min-w-0 flex-1 truncate text-[var(--color-text-secondary)]">
                {link.url}
              </span>
              <button
                type="button"
                onClick={() => onRemoveLink(index)}
                className="text-[var(--color-danger)] hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2 rounded-md bg-[var(--color-bg-card)] px-2 py-1.5"
            >
              <span className="font-semibold text-[var(--color-text-muted)]">
                {file.type.startsWith('image/')
                  ? 'Image'
                  : file.type.startsWith('video/')
                    ? 'Video'
                    : 'File'}
              </span>
              <span className="min-w-0 flex-1 truncate text-[var(--color-text-secondary)]">
                {file.name}
              </span>
              <span className="text-[var(--color-text-muted)]">{formatFileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="text-[var(--color-danger)] hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
        Up to {MAX_ATTACHMENTS} files, 100MB each.
      </p>
    </div>
  );
}

function AttachmentList({ attachments }: { attachments?: DiscussionAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  const openAttachment = async (attachment: DiscussionAttachment) => {
    try {
      const url = await getDiscussionAttachmentUrl(attachment.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open attachment';
      window.alert(message);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          onClick={() => openAttachment(attachment)}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-bg-muted)]"
        >
          <Badge
            variant={
              attachment.type === 'LINK'
                ? 'accent'
                : attachment.type === 'IMAGE'
                  ? 'success'
                  : attachment.type === 'VIDEO'
                    ? 'warning'
                    : 'neutral'
            }
            size="sm"
          >
            {attachment.type === 'LINK'
              ? 'Link'
              : attachment.type === 'IMAGE'
                ? 'Image'
                : attachment.type === 'VIDEO'
                  ? 'Video'
                  : 'File'}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">
            {attachmentLabel(attachment)}
          </span>
          {attachment.fileSizeBytes && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatFileSize(attachment.fileSizeBytes)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function DiscussionsPanel({ adminMode = false }: DiscussionsPanelProps) {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === ROLES.ADMIN;
  const isTeacher = currentUser?.role === ROLES.TEACHER;
  const isStudent = currentUser?.role === ROLES.STUDENT;

  const [tab, setTab] = useState<TabKey>('discussion');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [classFilter, setClassFilter] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [items, setItems] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Discussion | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: 'DISCUSSION' as DiscussionType,
    scope: 'CLASS' as DiscussionScope,
    classId: undefined as number | undefined,
    title: '',
    content: '',
    links: [] as DraftLink[],
    files: [] as File[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [createLinkInput, setCreateLinkInput] = useState('');

  const [replyContent, setReplyContent] = useState('');
  const [replyLinks, setReplyLinks] = useState<DraftLink[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyLinkInput, setReplyLinkInput] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load classes for filters/creation
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (isStudent) {
          const list = await listMyClasses();
          if (!cancelled) setClasses(list);
        } else if (isTeacher || isAdmin) {
          const result = await listClasses({ pageSize: 100 });
          const arr = (result as unknown as { items?: ClassItem[] }).items
            ?? (result as unknown as ClassItem[]);
          if (!cancelled) setClasses(Array.isArray(arr) ? arr : []);
        }
      } catch (e) {
        console.error('Failed to load classes for discussions panel', e);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isStudent, isTeacher, isAdmin]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: ListDiscussionsParams = {
        type: tab === 'announcement' ? 'ANNOUNCEMENT' : 'DISCUSSION',
        search: debouncedSearch || undefined,
        limit: 50,
      };
      if (scopeFilter === 'global') params.scope = 'GLOBAL';
      if (scopeFilter === 'class') {
        params.scope = 'CLASS';
        if (classFilter) params.classId = classFilter;
      }
      const res = await listDiscussions(params);
      setItems(res.data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load list';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tab, scopeFilter, classFilter, debouncedSearch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const refreshSelected = useCallback(
    async (id: number) => {
      setSelectedLoading(true);
      try {
        const fresh = await getDiscussion(id);
        setSelected(fresh);
      } catch (e) {
        console.error('Failed to refresh discussion', e);
      } finally {
        setSelectedLoading(false);
      }
    },
    [],
  );

  const handleSelect = async (d: Discussion) => {
    setSelected(d);
    setReplyContent('');
    setReplyLinks([]);
    setReplyFiles([]);
    setReplyLinkInput('');
    await refreshSelected(d.id);
  };

  const addCreateFiles = (files: FileList | null) => {
    if (!files) return;
    setCreateForm((f) => ({
      ...f,
      files: [...f.files, ...Array.from(files)].slice(0, MAX_ATTACHMENTS),
    }));
  };

  const addReplyFiles = (files: FileList | null) => {
    if (!files) return;
    setReplyFiles((current) => [...current, ...Array.from(files)].slice(0, MAX_ATTACHMENTS));
  };

  const addCreateLink = () => {
    const url = createLinkInput.trim();
    if (!isValidUrl(url)) {
      setError('Please enter a valid http(s) link');
      return;
    }
    setCreateForm((f) => ({ ...f, links: [...f.links, { url }] }));
    setCreateLinkInput('');
    setError(null);
  };

  const addReplyLink = () => {
    const url = replyLinkInput.trim();
    if (!isValidUrl(url)) {
      setError('Please enter a valid http(s) link');
      return;
    }
    setReplyLinks((current) => [...current, { url }]);
    setReplyLinkInput('');
    setError(null);
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (!createForm.content.trim() && createForm.links.length === 0 && createForm.files.length === 0) {
      setError('Please enter content, add a link, or attach a file');
      return;
    }
    if (createForm.scope === 'CLASS' && !createForm.classId) {
      setError('Please select a class');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createDiscussion({
        scope: createForm.scope,
        type: createForm.type,
        classId: createForm.scope === 'CLASS' ? createForm.classId : undefined,
        title: createForm.title.trim(),
        content: createForm.content.trim(),
        links: createForm.links,
        files: createForm.files,
      });
      setCreating(false);
      setCreateForm({
        type: 'DISCUSSION',
        scope: 'CLASS',
        classId: undefined,
        title: '',
        content: '',
        links: [],
        files: [],
      });
      setCreateLinkInput('');
      await reload();
      await handleSelect(created);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to create post';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selected || (!replyContent.trim() && replyLinks.length === 0 && replyFiles.length === 0)) return;
    setSubmitting(true);
    try {
      await createReply(selected.id, replyContent.trim(), replyLinks, replyFiles);
      setReplyContent('');
      setReplyLinks([]);
      setReplyFiles([]);
      setReplyLinkInput('');
      await refreshSelected(selected.id);
      await reload();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReply = async (reply: DiscussionReply) => {
    if (!selected) return;
    if (!window.confirm('Delete this reply?')) return;
    try {
      await deleteReply(reply.id);
      await refreshSelected(selected.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditReply = async (reply: DiscussionReply) => {
    const next = window.prompt('Edit content:', reply.content);
    if (!next || !next.trim() || next === reply.content) return;
    try {
      await updateReply(reply.id, next.trim());
      if (selected) await refreshSelected(selected.id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to edit';
      window.alert(message);
    }
  };

  const handleDeleteDiscussion = async (d: Discussion) => {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    try {
      await deleteDiscussion(d.id);
      if (selected?.id === d.id) setSelected(null);
      await reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to delete';
      window.alert(message);
    }
  };

  const handleTogglePin = async (d: Discussion) => {
    try {
      const updated = await updateDiscussion(d.id, { isPinned: !d.isPinned });
      if (selected?.id === d.id) setSelected({ ...selected, isPinned: updated.isPinned });
      await reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to update';
      window.alert(message);
    }
  };

  const handleToggleLock = async (d: Discussion) => {
    try {
      const updated = await updateDiscussion(d.id, { isLocked: !d.isLocked });
      if (selected?.id === d.id) setSelected({ ...selected, isLocked: updated.isLocked });
      await reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to update';
      window.alert(message);
    }
  };

  const canModerate = useCallback(
    (d: Discussion) => {
      if (isAdmin) return true;
      if (isTeacher && d.classId !== null) {
        // teacher of this class — best effort check; backend enforces
        return true;
      }
      return false;
    },
    [isAdmin, isTeacher],
  );

  const canDeleteDiscussion = useCallback(
    (d: Discussion) => {
      if (isAdmin) return true;
      if (currentUser && Number(currentUser.id) === d.authorId) return true;
      if (isTeacher && d.classId !== null) return true;
      return false;
    },
    [isAdmin, isTeacher, currentUser],
  );

  const canDeleteReply = useCallback(
    (reply: DiscussionReply) => {
      if (isAdmin) return true;
      if (currentUser && Number(currentUser.id) === reply.authorId) return true;
      if (isTeacher && selected?.classId !== null) return true;
      return false;
    },
    [isAdmin, isTeacher, currentUser, selected],
  );

  const canEditReply = useCallback(
    (reply: DiscussionReply) => {
      if (isAdmin) return true;
      if (currentUser && Number(currentUser.id) === reply.authorId) {
        const ageMs = Date.now() - new Date(reply.createdAt).getTime();
        return ageMs < 15 * 60 * 1000;
      }
      return false;
    },
    [isAdmin, currentUser],
  );

  const canCreate = !!currentUser; // backend will enforce scope-specific perms

  const availableTypes: DiscussionType[] = useMemo(() => {
    if (isStudent) return ['DISCUSSION'];
    return ['DISCUSSION', 'ANNOUNCEMENT'];
  }, [isStudent]);

  const availableScopes: DiscussionScope[] = useMemo(() => {
    if (isStudent) return ['CLASS'];
    if (isTeacher) {
      if (createForm.type === 'ANNOUNCEMENT') return ['CLASS'];
      return ['CLASS', 'GLOBAL'];
    }
    // admin
    return ['CLASS', 'GLOBAL'];
  }, [isStudent, isTeacher, createForm.type]);

  return (
    <div className="flex h-[min(80vh,900px)] flex-col">
      {/* Header tabs */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3">
        <div className="flex items-center gap-1 rounded-xl bg-[var(--color-bg-muted)] p-1">
          <button
            type="button"
            onClick={() => {
              setTab('discussion');
              setSelected(null);
            }}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
              tab === 'discussion'
                ? 'bg-[var(--color-bg-card)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            💬 Discussions
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('announcement');
              setSelected(null);
            }}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
              tab === 'announcement'
                ? 'bg-[var(--color-bg-card)] text-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            📢 Announcements
          </button>
        </div>

        {canCreate && !creating && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCreating(true);
              setSelected(null);
              setCreateForm({
                type: tab === 'announcement' ? 'ANNOUNCEMENT' : 'DISCUSSION',
                scope: 'CLASS',
                classId: undefined,
                title: '',
                content: '',
                links: [],
                files: [],
              });
              setCreateLinkInput('');
            }}
          >
            + New {tab === 'announcement' ? 'announcement' : 'discussion'}
          </Button>
        )}
      </div>

      {/* Main split layout */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Left: filters + list */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* Filters */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-1 rounded-lg bg-[var(--color-bg-muted)] p-1 text-xs">
              {(['all', 'global', 'class'] as ScopeFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScopeFilter(s)}
                  className={`flex-1 rounded-md px-2 py-1 font-medium transition-all ${
                    scopeFilter === s
                      ? 'bg-[var(--color-bg-card)] text-[var(--color-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {s === 'all' ? 'All' : s === 'global' ? 'School-wide' : 'By class'}
                </button>
              ))}
            </div>

            {scopeFilter === 'class' && classes.length > 0 && (
              <select
                value={classFilter ?? ''}
                onChange={(e) => setClassFilter(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm focus-ring-brand"
              >
                <option value="">All my classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.gradeLevel ? `(G${c.gradeLevel})` : ''}
                  </option>
                ))}
              </select>
            )}

            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]">
            {loading ? (
              <div className="flex h-full items-center justify-center p-6">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-[var(--color-text-muted)]">
                <span className="text-3xl">🗒️</span>
                <p>No {tab === 'announcement' ? 'announcements' : 'discussions'} yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border-subtle)]">
                {items.map((d) => {
                  const active = selected?.id === d.id;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(d)}
                        className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-muted)] ${
                          active ? 'bg-[var(--color-primary-soft)]' : ''
                        }`}
                      >
                        <div className="flex w-full items-center gap-2">
                          {d.isPinned && <span title="Pinned">📌</span>}
                          {d.isLocked && <span title="Locked">🔒</span>}
                          <span className="flex-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                            {d.title}
                          </span>
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                          {d.scope === 'GLOBAL' ? (
                            <Badge variant="accent" size="sm">School-wide</Badge>
                          ) : (
                            <Badge variant="brand" size="sm">{d.class?.name ?? 'Class'}</Badge>
                          )}
                          <span>•</span>
                          <span>{authorName(d.author)}</span>
                          <span>•</span>
                          <span>{formatDate(d.createdAt)}</span>
                          <span className="ml-auto">
                            {(d.attachments?.length ?? 0) > 0
                              ? `${d.attachments?.length} attachments - `
                              : ''}
                            💬 {d._count?.replies ?? 0}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: detail / create form */}
        <div className="flex min-h-0 flex-col rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)]">
          {error && (
            <div className="m-3 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          )}

          {creating ? (
            <div className="flex h-full flex-col overflow-y-auto p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  New {createForm.type === 'ANNOUNCEMENT' ? 'announcement' : 'discussion'}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                      Type
                    </label>
                    <select
                      value={createForm.type}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          type: e.target.value as DiscussionType,
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus-ring-brand"
                    >
                      {availableTypes.map((t) => (
                        <option key={t} value={t}>
                          {t === 'ANNOUNCEMENT' ? 'Announcement' : 'Discussion'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                      Scope
                    </label>
                    <select
                      value={createForm.scope}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          scope: e.target.value as DiscussionScope,
                          classId: e.target.value === 'GLOBAL' ? undefined : f.classId,
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus-ring-brand"
                    >
                      {availableScopes.map((s) => (
                        <option key={s} value={s}>
                          {s === 'GLOBAL' ? 'School-wide' : 'By class'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {createForm.scope === 'CLASS' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                      Class
                    </label>
                    <select
                      value={createForm.classId ?? ''}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          classId: e.target.value ? Number(e.target.value) : undefined,
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus-ring-brand"
                    >
                      <option value="">-- Select a class --</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Input
                  label="Title"
                  placeholder="e.g. Question about chapter 3 exercises"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                />

                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                    Content
                  </label>
                  <textarea
                    rows={8}
                    value={createForm.content}
                    onChange={(e) => setCreateForm((f) => ({ ...f, content: e.target.value }))}
                    placeholder="Describe your question / announcement in detail…"
                    className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus-ring-brand"
                  />
                </div>

                <AttachmentComposer
                  prefix="discussion-create"
                  linkInput={createLinkInput}
                  setLinkInput={setCreateLinkInput}
                  onAddLink={addCreateLink}
                  links={createForm.links}
                  onRemoveLink={(index) =>
                    setCreateForm((f) => ({
                      ...f,
                      links: f.links.filter((_, i) => i !== index),
                    }))
                  }
                  files={createForm.files}
                  onAddFiles={addCreateFiles}
                  onRemoveFile={(index) =>
                    setCreateForm((f) => ({
                      ...f,
                      files: f.files.filter((_, i) => i !== index),
                    }))
                  }
                />

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setCreating(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreate} isLoading={submitting}>
                    Post
                  </Button>
                </div>
              </div>
            </div>
          ) : selected ? (
            <DiscussionDetail
              discussion={selected}
              loading={selectedLoading}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              replyLinks={replyLinks}
              replyLinkInput={replyLinkInput}
              setReplyLinkInput={setReplyLinkInput}
              onAddReplyLink={addReplyLink}
              onRemoveReplyLink={(index) =>
                setReplyLinks((current) => current.filter((_, i) => i !== index))
              }
              replyFiles={replyFiles}
              onAddReplyFiles={addReplyFiles}
              onRemoveReplyFile={(index) =>
                setReplyFiles((current) => current.filter((_, i) => i !== index))
              }
              onSendReply={handleSendReply}
              onDeleteReply={handleDeleteReply}
              onEditReply={handleEditReply}
              onDeleteDiscussion={() => handleDeleteDiscussion(selected)}
              onTogglePin={() => handleTogglePin(selected)}
              onToggleLock={() => handleToggleLock(selected)}
              canModerate={canModerate(selected)}
              canDeleteDiscussion={canDeleteDiscussion(selected)}
              canDeleteReply={canDeleteReply}
              canEditReply={canEditReply}
              currentUserId={currentUser ? Number(currentUser.id) : null}
              adminMode={adminMode}
              submitting={submitting}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-[var(--color-text-muted)]">
              <span className="text-4xl">💬</span>
              <p>Select an item to view details</p>
              <p className="text-xs">or click "New" to start a new post</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DiscussionDetailProps {
  discussion: Discussion;
  loading: boolean;
  replyContent: string;
  setReplyContent: (v: string) => void;
  replyLinks: DraftLink[];
  replyLinkInput: string;
  setReplyLinkInput: (v: string) => void;
  onAddReplyLink: () => void;
  onRemoveReplyLink: (index: number) => void;
  replyFiles: File[];
  onAddReplyFiles: (files: FileList | null) => void;
  onRemoveReplyFile: (index: number) => void;
  onSendReply: () => void;
  onDeleteReply: (r: DiscussionReply) => void;
  onEditReply: (r: DiscussionReply) => void;
  onDeleteDiscussion: () => void;
  onTogglePin: () => void;
  onToggleLock: () => void;
  canModerate: boolean;
  canDeleteDiscussion: boolean;
  canDeleteReply: (r: DiscussionReply) => boolean;
  canEditReply: (r: DiscussionReply) => boolean;
  currentUserId: number | null;
  adminMode: boolean;
  submitting: boolean;
}

function DiscussionDetail({
  discussion,
  loading,
  replyContent,
  setReplyContent,
  replyLinks,
  replyLinkInput,
  setReplyLinkInput,
  onAddReplyLink,
  onRemoveReplyLink,
  replyFiles,
  onAddReplyFiles,
  onRemoveReplyFile,
  onSendReply,
  onDeleteReply,
  onEditReply,
  onDeleteDiscussion,
  onTogglePin,
  onToggleLock,
  canModerate,
  canDeleteDiscussion,
  canDeleteReply,
  canEditReply,
  adminMode,
  submitting,
}: DiscussionDetailProps) {
  const name = authorName(discussion.author);
  const replies = discussion.replies ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="border-b border-[var(--color-border-subtle)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={discussion.type === 'ANNOUNCEMENT' ? 'warning' : 'info'} size="sm">
                {discussion.type === 'ANNOUNCEMENT' ? '📢 Announcement' : '💬 Discussion'}
              </Badge>
              {discussion.scope === 'GLOBAL' ? (
                <Badge variant="accent" size="sm">School-wide</Badge>
              ) : (
                <Badge variant="brand" size="sm">{discussion.class?.name ?? 'Class'}</Badge>
              )}
              {discussion.isPinned && <Badge variant="success" size="sm">📌 Pinned</Badge>}
              {discussion.isLocked && <Badge variant="neutral" size="sm">🔒 Locked</Badge>}
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{discussion.title}</h3>
          </div>
          <div className="flex shrink-0 gap-1">
            {canModerate && (
              <>
                <Button variant="outline" size="sm" onClick={onTogglePin}>
                  {discussion.isPinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button variant="outline" size="sm" onClick={onToggleLock}>
                  {discussion.isLocked ? 'Unlock' : 'Lock'}
                </Button>
              </>
            )}
            {canDeleteDiscussion && (
              <Button variant="danger" size="sm" onClick={onDeleteDiscussion}>
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-xs font-bold text-[var(--color-primary)]">
            {authorInitials(name)}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[var(--color-text-secondary)]">{name}</span>
              <RoleBadge role={discussion.author.role} />
              {adminMode && (
                <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">
                  ID: {discussion.author.id}
                </span>
              )}
            </div>
            <span>{formatDate(discussion.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-[var(--color-border-subtle)] p-5">
          {loading ? (
            <Spinner />
          ) : (
            <>
              {discussion.content && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
                  {discussion.content}
                </p>
              )}
              <AttachmentList attachments={discussion.attachments} />
            </>
          )}
        </div>

        {/* Replies */}
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            💬 {replies.length} replies
          </div>
          {replies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
              No replies yet. Be the first!
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {replies.map((r) => {
                const rName = authorName(r.author);
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary-soft)] text-xs font-bold text-[var(--color-secondary)]">
                        {authorInitials(rName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {rName}
                          </span>
                          <RoleBadge role={r.author.role} />
                          <span className="text-[var(--color-text-muted)]">
                            {formatDate(r.createdAt)}
                          </span>
                          {r.updatedAt !== r.createdAt && (
                            <span className="italic text-[var(--color-text-muted)]">(edited)</span>
                          )}
                          <div className="ml-auto flex gap-1">
                            {canEditReply(r) && (
                              <button
                                type="button"
                                onClick={() => onEditReply(r)}
                                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                              >
                                Edit
                              </button>
                            )}
                            {canDeleteReply(r) && (
                              <button
                                type="button"
                                onClick={() => onDeleteReply(r)}
                                className="text-xs text-[var(--color-danger)] hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                        {r.content && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
                            {r.content}
                          </p>
                        )}
                        <AttachmentList attachments={r.attachments} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Reply input */}
      {!discussion.isLocked && (
        <div className="border-t border-[var(--color-border-subtle)] p-4">
          <div className="flex flex-col gap-2">
            <textarea
              rows={2}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply…"
              className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus-ring-brand"
            />
            <AttachmentComposer
              prefix={`discussion-reply-${discussion.id}`}
              linkInput={replyLinkInput}
              setLinkInput={setReplyLinkInput}
              onAddLink={onAddReplyLink}
              links={replyLinks}
              onRemoveLink={onRemoveReplyLink}
              files={replyFiles}
              onAddFiles={onAddReplyFiles}
              onRemoveFile={onRemoveReplyFile}
            />
            <Button
              variant="primary"
              onClick={onSendReply}
              disabled={
                (!replyContent.trim() && replyLinks.length === 0 && replyFiles.length === 0) ||
                submitting
              }
              isLoading={submitting}
              className="self-end"
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
