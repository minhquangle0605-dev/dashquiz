import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { listTeacherExams, publishExam } from '@/services/exam.api';
import type { ClassItem, TeacherExam, TeacherExamStatus } from '@/types/exam';
import { ExamMonitoringPanel } from './ExamMonitoringPanel';

const STATUS_CONFIG: Record<TeacherExamStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Nháp', variant: 'neutral' },
  PUBLISHED: { label: 'Đã xuất bản', variant: 'success' },
  SCHEDULED: { label: 'Đã lên lịch', variant: 'info' },
  CLOSED: { label: 'Đã đóng', variant: 'warning' },
};

interface ClassExamsTabProps {
  selectedClass: ClassItem;
}

export function ClassExamsTab({ selectedClass }: ClassExamsTabProps) {
  const navigate = useNavigate();
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [monitoringExamId, setMonitoringExamId] = useState<number | null>(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTeacherExams({
        classId: selectedClass.id,
        pageSize: 100,
      });
      const items = Array.isArray(res)
        ? (res as TeacherExam[])
        : ((res as unknown as { items?: TeacherExam[] }).items ?? []);
      setExams(items);
    } catch {
      toast.error('Không tải được danh sách Exam.');
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClass.id]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handlePublish = async (exam: TeacherExam) => {
    setPublishingId(exam.id);
    try {
      await publishExam(exam.id);
      toast.success('Đã xuất bản Exam!');
      fetchExams();
    } catch {
      toast.error('Không xuất bản được.');
    } finally {
      setPublishingId(null);
    }
  };

  const handleCreate = () => {
    const params = new URLSearchParams({
      classId: String(selectedClass.id),
      returnTo: '/teacher/classes',
    });
    if (selectedClass.subjectId) {
      params.set('subjectId', String(selectedClass.subjectId));
    }
    navigate(`/teacher/exams/create?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
            Bài thi của lớp
          </h3>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            Tất cả Exam đã được gán cho lớp{' '}
            <span className="font-semibold text-[var(--color-text-primary)]">
              {selectedClass.name}
            </span>
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleCreate}
          leftIcon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Tạo Exam cho lớp
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" label="Loading exams" />
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-border)] py-14 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand-soft text-[var(--color-primary)]">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-[var(--color-text-primary)]">
            Lớp chưa có Exam nào
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Bấm "Tạo Exam cho lớp" để bắt đầu.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {exams.map((exam) => {
            const sc = STATUS_CONFIG[exam.status] ?? STATUS_CONFIG.DRAFT;
            const schedule = exam.examSchedules?.[0];
            return (
              <li
                key={exam.id}
                className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-primary-soft-strong)] hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                        {exam.title}
                      </h4>
                      <Badge variant={sc.variant} size="sm">{sc.label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {exam.durationMin} phút
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {exam.totalQuestions} câu
                      </span>
                      {schedule && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(schedule.startTime).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {exam.status === 'DRAFT' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/teacher/exams/create?edit=${exam.id}`)}
                      >
                        Sửa
                      </Button>
                    )}
                    {exam.status === 'DRAFT' && (
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={publishingId === exam.id}
                        onClick={() => handlePublish(exam)}
                      >
                        Xuất bản
                      </Button>
                    )}
                    {exam.status !== 'DRAFT' && (
                      <Button
                        variant={monitoringExamId === exam.id ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() =>
                          setMonitoringExamId((current) => (current === exam.id ? null : exam.id))
                        }
                      >
                        Theo dõi
                      </Button>
                    )}
                    {exam.status !== 'DRAFT' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/teacher/exams`)}
                      >
                        Quản lý
                      </Button>
                    )}
                  </div>
                </div>
                {monitoringExamId === exam.id && (
                  <div className="mt-4">
                    <ExamMonitoringPanel
                      exam={exam}
                      classId={selectedClass.id}
                      onClose={() => setMonitoringExamId(null)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
