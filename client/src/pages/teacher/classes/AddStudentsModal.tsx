import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import type { AvailableStudent, ClassNameOption } from '@/services/class.api';
import type { ClassItem } from '@/types/exam';

const selectBase =
  'h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-input)] px-3.5 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)] focus:outline-none focus:shadow-[var(--ring-brand)]';

interface AddStudentsModalProps {
  isOpen: boolean;
  saving: boolean;
  loading: boolean;
  selectedClass: ClassItem | null;
  searchValue: string;
  gradeFilter: number | '';
  classNameFilter: string;
  classNameOptions: ClassNameOption[];
  availableStudents: AvailableStudent[];
  selectedIds: Set<number>;
  allVisibleSelected: boolean;
  onSearchChange: (value: string) => void;
  onGradeFilterChange: (value: number | '') => void;
  onClassNameFilterChange: (value: string) => void;
  onToggleStudent: (id: number) => void;
  onToggleSelectAll: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function AddStudentsModal({
  isOpen,
  saving,
  loading,
  selectedClass,
  searchValue,
  gradeFilter,
  classNameFilter,
  classNameOptions,
  availableStudents,
  selectedIds,
  allVisibleSelected,
  onSearchChange,
  onGradeFilterChange,
  onClassNameFilterChange,
  onToggleStudent,
  onToggleSelectAll,
  onClose,
  onSubmit,
}: AddStudentsModalProps) {
  const hasFilter = !!(
    searchValue.trim() ||
    gradeFilter !== '' ||
    classNameFilter
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm học sinh"
      description={
        selectedClass
          ? `Chọn học sinh để thêm vào lớp "${selectedClass.name}".`
          : undefined
      }
      size="lg"
    >
      <div className="space-y-4">
        {/* Filter row */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            className={selectBase}
            value={gradeFilter === '' ? '' : String(gradeFilter)}
            onChange={(e) => {
              const val = e.target.value;
              onGradeFilterChange(val === '' ? '' : Number(val));
              onClassNameFilterChange('');
            }}
          >
            <option value="">Tất cả khối</option>
            {[10, 11, 12].map((g) => (
              <option key={g} value={g}>
                Khối {g}
              </option>
            ))}
          </select>

          <select
            className={selectBase}
            value={classNameFilter}
            onChange={(e) => onClassNameFilterChange(e.target.value)}
          >
            <option value="">Tất cả lớp chủ nhiệm</option>
            {classNameOptions.map((opt) => (
              <option key={`${opt.gradeLevel}-${opt.name}`} value={opt.name}>
                {opt.name} (K{opt.gradeLevel})
              </option>
            ))}
          </select>

          <Input
            placeholder="Tìm theo tên / username…"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            leftIcon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            }
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2.5">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/40"
              checked={allVisibleSelected}
              disabled={availableStudents.length === 0 || loading}
              onChange={onToggleSelectAll}
            />
            <span>Chọn tất cả ({availableStudents.length})</span>
          </label>
          <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--color-primary)]">
            {selectedIds.size} đã chọn
          </span>
        </div>

        <div className="max-h-80 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner size="sm" label="Loading students" />
            </div>
          ) : availableStudents.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
              {hasFilter
                ? 'Không tìm thấy học sinh phù hợp.'
                : 'Không còn học sinh nào để thêm.'}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border-subtle)]">
              {availableStudents.map((s) => {
                const checked = selectedIds.has(s.id);
                return (
                  <li key={s.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-[var(--color-bg-subtle)] ${
                        checked ? 'bg-[var(--color-primary-soft)]/60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/40"
                        checked={checked}
                        onChange={() => onToggleStudent(s.id)}
                      />
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[11px] font-bold text-white">
                        {(s.fullName || s.username || '?')
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                          {s.fullName || s.username}
                        </p>
                        <p className="truncate text-xs text-[var(--color-text-muted)]">
                          @{s.username}
                          {s.homeroomClassName && (
                            <span className="ml-2">
                              · Lớp {s.homeroomClassName}
                              {s.gradeLevel ? ` (K${s.gradeLevel})` : ''}
                            </span>
                          )}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            isLoading={saving}
            disabled={selectedIds.size === 0}
            onClick={onSubmit}
          >
            Thêm {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
