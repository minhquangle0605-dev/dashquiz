import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/Table';
import { DiscussionsPanel } from '@/components/shared/DiscussionsPanel';
import {
  adminListDiscussions,
  deleteDiscussion,
  updateDiscussion,
} from '@/services/discussion.api';
import type {
  Discussion,
  DiscussionScope,
  DiscussionType,
  ListDiscussionsParams,
} from '@/types/discussion';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminDiscussionsPage() {
  const [items, setItems] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    scope?: DiscussionScope;
    type?: DiscussionType;
    search?: string;
  }>({});
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1, limit: 20 });
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const reload = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params: ListDiscussionsParams = {
          ...filters,
          search: debouncedSearch || undefined,
          page,
          limit: 20,
        };
        const res = await adminListDiscussions(params);
        setItems(res.data);
        setPagination({
          page: res.pagination.page,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
          limit: res.pagination.limit,
        });
      } catch (e: unknown) {
        const m = e instanceof Error ? e.message : 'Không tải được danh sách';
        setError(m);
      } finally {
        setLoading(false);
      }
    },
    [filters, debouncedSearch],
  );

  useEffect(() => {
    reload(1);
  }, [reload]);

  const handleDelete = async (d: Discussion) => {
    if (!window.confirm(`Xóa "${d.title}"?\nTác giả: ${d.author.fullName || d.author.username}`)) return;
    try {
      await deleteDiscussion(d.id);
      await reload(pagination.page);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : 'Không xóa được';
      window.alert(m);
    }
  };

  const handleTogglePin = async (d: Discussion) => {
    try {
      await updateDiscussion(d.id, { isPinned: !d.isPinned });
      await reload(pagination.page);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : 'Không cập nhật được';
      window.alert(m);
    }
  };

  const handleToggleLock = async (d: Discussion) => {
    try {
      await updateDiscussion(d.id, { isLocked: !d.isLocked });
      await reload(pagination.page);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : 'Không cập nhật được';
      window.alert(m);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Quản lý Thảo luận & Thông báo
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Xem toàn bộ bài viết, người tạo và lớp liên quan. Có thể xóa, pin, khóa bất kỳ nội dung nào.
          </p>
        </div>
        <Button variant="primary" onClick={() => setPanelOpen(true)}>
          Mở panel thảo luận
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            placeholder="Tìm theo tiêu đề hoặc nội dung…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={filters.scope ?? ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                scope: (e.target.value || undefined) as DiscussionScope | undefined,
              }))
            }
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus-ring-brand"
          >
            <option value="">Tất cả phạm vi</option>
            <option value="GLOBAL">Toàn trường</option>
            <option value="CLASS">Theo lớp</option>
          </select>
          <select
            value={filters.type ?? ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                type: (e.target.value || undefined) as DiscussionType | undefined,
              }))
            }
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus-ring-brand"
          >
            <option value="">Tất cả loại</option>
            <option value="ANNOUNCEMENT">Thông báo</option>
            <option value="DISCUSSION">Thảo luận</option>
          </select>
          <Button variant="outline" onClick={() => reload(1)}>
            Làm mới
          </Button>
        </div>
      </Card>

      {error && (
        <Card padding="sm">
          <div className="text-sm text-[var(--color-danger)]">{error}</div>
        </Card>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            Không có bài viết nào khớp với bộ lọc.
          </div>
        </Card>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Tiêu đề</TableHeaderCell>
              <TableHeaderCell>Loại</TableHeaderCell>
              <TableHeaderCell>Phạm vi / Lớp</TableHeaderCell>
              <TableHeaderCell>Người tạo</TableHeaderCell>
              <TableHeaderCell>Tạo lúc</TableHeaderCell>
              <TableHeaderCell>Phản hồi</TableHeaderCell>
              <TableHeaderCell>Trạng thái</TableHeaderCell>
              <TableHeaderCell>Thao tác</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="max-w-[260px]">
                  <div className="font-semibold text-[var(--color-text-primary)] truncate" title={d.title}>
                    {d.title}
                  </div>
                  <div className="line-clamp-1 text-xs text-[var(--color-text-muted)]">{d.content}</div>
                </TableCell>
                <TableCell>
                  {d.type === 'ANNOUNCEMENT' ? (
                    <Badge variant="warning" size="sm">📢 Thông báo</Badge>
                  ) : (
                    <Badge variant="info" size="sm">💬 Thảo luận</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {d.scope === 'GLOBAL' ? (
                    <Badge variant="accent" size="sm">Toàn trường</Badge>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <Badge variant="brand" size="sm">
                        {d.class?.name ?? `Class #${d.classId}`}
                      </Badge>
                      {d.class?.gradeLevel && (
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          Khối {d.class.gradeLevel}
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {d.author.fullName || d.author.username}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      @{d.author.username} · {d.author.role}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatDateTime(d.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="neutral" size="sm">
                    {d._count?.replies ?? 0}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {d.isPinned && <Badge variant="success" size="sm">📌</Badge>}
                    {d.isLocked && <Badge variant="neutral" size="sm">🔒</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleTogglePin(d)}>
                      {d.isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleLock(d)}>
                      {d.isLocked ? 'Mở' : 'Khóa'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(d)}>
                      Xóa
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">
            Trang {pagination.page}/{pagination.totalPages} · {pagination.total} bài viết
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => reload(pagination.page - 1)}
            >
              ← Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => reload(pagination.page + 1)}
            >
              Sau →
            </Button>
          </div>
        </div>
      )}

      {/* Panel modal (also accessible via menu) */}
      <Modal
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        size="3xl"
        title="Thảo luận & Thông báo"
        description="Chế độ admin: xem và moderate tất cả bài viết"
      >
        <DiscussionsPanel adminMode />
      </Modal>
    </div>
  );
}
