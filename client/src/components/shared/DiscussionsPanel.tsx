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
  getDiscussion,
  listDiscussions,
  updateDiscussion,
  updateReply,
} from '@/services/discussion.api';
import { listClasses, listMyClasses } from '@/services/class.api';
import type {
  Discussion,
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} giờ trước`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} ngày trước`;
  return d.toLocaleDateString('vi-VN');
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

function RoleBadge({ role }: { role: string }) {
  const r = role.toUpperCase();
  if (r === 'ADMIN') return <Badge variant="danger" size="sm">Admin</Badge>;
  if (r === 'TEACHER') return <Badge variant="brand" size="sm">Giáo viên</Badge>;
  if (r === 'STUDENT') return <Badge variant="info" size="sm">Học sinh</Badge>;
  return <Badge variant="neutral" size="sm">{r}</Badge>;
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
  });
  const [submitting, setSubmitting] = useState(false);

  const [replyContent, setReplyContent] = useState('');

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
      const message = e instanceof Error ? e.message : 'Không tải được danh sách';
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
    await refreshSelected(d.id);
  };

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.content.trim()) {
      setError('Vui lòng nhập tiêu đề và nội dung');
      return;
    }
    if (createForm.scope === 'CLASS' && !createForm.classId) {
      setError('Vui lòng chọn lớp');
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
      });
      setCreating(false);
      setCreateForm({
        type: 'DISCUSSION',
        scope: 'CLASS',
        classId: undefined,
        title: '',
        content: '',
      });
      await reload();
      await handleSelect(created);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Không tạo được bài viết';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selected || !replyContent.trim()) return;
    setSubmitting(true);
    try {
      await createReply(selected.id, replyContent.trim());
      setReplyContent('');
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
    if (!window.confirm('Xóa reply này?')) return;
    try {
      await deleteReply(reply.id);
      await refreshSelected(selected.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditReply = async (reply: DiscussionReply) => {
    const next = window.prompt('Sửa nội dung:', reply.content);
    if (!next || !next.trim() || next === reply.content) return;
    try {
      await updateReply(reply.id, next.trim());
      if (selected) await refreshSelected(selected.id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Không sửa được';
      window.alert(message);
    }
  };

  const handleDeleteDiscussion = async (d: Discussion) => {
    if (!window.confirm(`Xóa "${d.title}"?`)) return;
    try {
      await deleteDiscussion(d.id);
      if (selected?.id === d.id) setSelected(null);
      await reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Không xóa được';
      window.alert(message);
    }
  };

  const handleTogglePin = async (d: Discussion) => {
    try {
      const updated = await updateDiscussion(d.id, { isPinned: !d.isPinned });
      if (selected?.id === d.id) setSelected({ ...selected, isPinned: updated.isPinned });
      await reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Không cập nhật được';
      window.alert(message);
    }
  };

  const handleToggleLock = async (d: Discussion) => {
    try {
      const updated = await updateDiscussion(d.id, { isLocked: !d.isLocked });
      if (selected?.id === d.id) setSelected({ ...selected, isLocked: updated.isLocked });
      await reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Không cập nhật được';
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
            💬 Thảo luận
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
            📢 Thông báo
          </button>
        </div>

        {canCreate && !creating && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCreating(true);
              setSelected(null);
              setCreateForm((f) => ({ ...f, type: tab === 'announcement' ? 'ANNOUNCEMENT' : 'DISCUSSION' }));
            }}
          >
            + Tạo {tab === 'announcement' ? 'thông báo' : 'thảo luận'}
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
                  {s === 'all' ? 'Tất cả' : s === 'global' ? 'Toàn trường' : 'Theo lớp'}
                </button>
              ))}
            </div>

            {scopeFilter === 'class' && classes.length > 0 && (
              <select
                value={classFilter ?? ''}
                onChange={(e) => setClassFilter(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm focus-ring-brand"
              >
                <option value="">Tất cả lớp của tôi</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.gradeLevel ? `(K${c.gradeLevel})` : ''}
                  </option>
                ))}
              </select>
            )}

            <Input
              placeholder="Tìm kiếm…"
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
                <p>Chưa có {tab === 'announcement' ? 'thông báo' : 'thảo luận'} nào</p>
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
                            <Badge variant="accent" size="sm">Toàn trường</Badge>
                          ) : (
                            <Badge variant="brand" size="sm">{d.class?.name ?? 'Lớp'}</Badge>
                          )}
                          <span>•</span>
                          <span>{authorName(d.author)}</span>
                          <span>•</span>
                          <span>{formatDate(d.createdAt)}</span>
                          <span className="ml-auto">💬 {d._count?.replies ?? 0}</span>
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
                  Tạo {createForm.type === 'ANNOUNCEMENT' ? 'thông báo' : 'thảo luận'}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  Hủy
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                      Loại
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
                          {t === 'ANNOUNCEMENT' ? 'Thông báo' : 'Thảo luận'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                      Phạm vi
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
                          {s === 'GLOBAL' ? 'Toàn trường' : 'Theo lớp'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {createForm.scope === 'CLASS' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                      Lớp
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
                      <option value="">-- Chọn lớp --</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Input
                  label="Tiêu đề"
                  placeholder="Ví dụ: Câu hỏi về bài tập chương 3"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                />

                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
                    Nội dung
                  </label>
                  <textarea
                    rows={8}
                    value={createForm.content}
                    onChange={(e) => setCreateForm((f) => ({ ...f, content: e.target.value }))}
                    placeholder="Mô tả chi tiết câu hỏi/thông báo của bạn…"
                    className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus-ring-brand"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setCreating(false)} disabled={submitting}>
                    Hủy
                  </Button>
                  <Button variant="primary" onClick={handleCreate} isLoading={submitting}>
                    Đăng
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
              <p>Chọn một mục để xem chi tiết</p>
              <p className="text-xs">hoặc nhấn "Tạo" để bắt đầu bài viết mới</p>
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
                {discussion.type === 'ANNOUNCEMENT' ? '📢 Thông báo' : '💬 Thảo luận'}
              </Badge>
              {discussion.scope === 'GLOBAL' ? (
                <Badge variant="accent" size="sm">Toàn trường</Badge>
              ) : (
                <Badge variant="brand" size="sm">{discussion.class?.name ?? 'Lớp'}</Badge>
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
                  {discussion.isPinned ? 'Bỏ pin' : 'Pin'}
                </Button>
                <Button variant="outline" size="sm" onClick={onToggleLock}>
                  {discussion.isLocked ? 'Mở khóa' : 'Khóa'}
                </Button>
              </>
            )}
            {canDeleteDiscussion && (
              <Button variant="danger" size="sm" onClick={onDeleteDiscussion}>
                Xóa
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
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
              {discussion.content}
            </p>
          )}
        </div>

        {/* Replies */}
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
            💬 {replies.length} phản hồi
          </div>
          {replies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
              Chưa có phản hồi. Hãy là người đầu tiên!
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
                            <span className="italic text-[var(--color-text-muted)]">(đã sửa)</span>
                          )}
                          <div className="ml-auto flex gap-1">
                            {canEditReply(r) && (
                              <button
                                type="button"
                                onClick={() => onEditReply(r)}
                                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                              >
                                Sửa
                              </button>
                            )}
                            {canDeleteReply(r) && (
                              <button
                                type="button"
                                onClick={() => onDeleteReply(r)}
                                className="text-xs text-[var(--color-danger)] hover:underline"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
                          {r.content}
                        </p>
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
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Viết phản hồi…"
              className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus-ring-brand"
            />
            <Button
              variant="primary"
              onClick={onSendReply}
              disabled={!replyContent.trim() || submitting}
              isLoading={submitting}
            >
              Gửi
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
