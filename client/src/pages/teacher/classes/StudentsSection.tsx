import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/Table';
import type { ClassItem, ClassStudent } from '@/types/exam';

interface StudentsSectionProps {
  selectedClass: ClassItem;
  students: ClassStudent[];
  loading: boolean;
  removingId: number | null;
  onOpenImport: () => void;
  onOpenAdd: () => void;
  onRemove: (studentId: number) => void;
}

export function StudentsSection({
  selectedClass,
  students,
  loading,
  removingId,
  onOpenImport,
  onOpenAdd,
  onRemove,
}: StudentsSectionProps) {
  return (
    <Card padding="lg">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
              {selectedClass.name}
            </h2>
            <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--color-primary)]">
              {students.length}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">Học sinh đang trong lớp</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenImport}
            leftIcon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            }
          >
            Import Excel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenAdd}
            leftIcon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Thêm học sinh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" label="Loading students" />
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[var(--color-border)] py-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Chưa có học sinh
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Nhấn "Thêm học sinh" hoặc import Excel để bắt đầu.
          </p>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>#</TableHeaderCell>
              <TableHeaderCell>Họ tên</TableHeaderCell>
              <TableHeaderCell>Username</TableHeaderCell>
              <TableHeaderCell>Ngày vào lớp</TableHeaderCell>
              <TableHeaderCell className="text-right">Hành động</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {students.map((s, idx) => (
              <TableRow key={s.studentId}>
                <TableCell className="tabular-nums text-[var(--color-text-muted)]">
                  {idx + 1}
                </TableCell>
                <TableCell className="font-medium text-[var(--color-text-primary)]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[10px] font-bold text-white">
                      {(s.student.fullName || s.student.username || '?')
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    {s.student.fullName || '—'}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">@{s.student.username}</TableCell>
                <TableCell className="text-xs">
                  {new Date(s.enrolledAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    isLoading={removingId === s.studentId}
                    onClick={() => onRemove(s.studentId)}
                    className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                  >
                    Xóa
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
