import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import {
  getClassCourse,
  getResourceDownloadUrl,
  listClassmates,
  listMyClasses,
  markCompletion,
  submitActivity,
} from '@/services/class.api';
import type {
  ClassActivity,
  ClassCourseOverview,
  ClassItem,
  ClassResource,
  ClassStudent,
} from '@/types/exam';

import { StudentClassExamsTab } from './classes/StudentClassExamsTab';
import { StudentRosterList } from './classes/StudentRosterList';

type EnrolledClass = ClassItem & { enrolledAt?: string };

type StudentClassTab = 'course' | 'exams';

export default function MyClassesPage() {
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<EnrolledClass | null>(null);
  const [course, setCourse] = useState<ClassCourseOverview | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [classmates, setClassmates] = useState<ClassStudent[]>([]);
  const [classmatesLoading, setClassmatesLoading] = useState(false);
  const [submissionText, setSubmissionText] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<StudentClassTab>('course');

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMyClasses();
      setClasses(data);
    } catch {
      toast.error('Failed to load your classes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const openCourse = async (cls: EnrolledClass) => {
    if (selectedClass?.id === cls.id) {
      setSelectedClass(null);
      setCourse(null);
      setClassmates([]);
      return;
    }
    setSelectedClass(cls);
    setActiveTab('course');
    setCourseLoading(true);
    setClassmatesLoading(true);
    try {
      const [courseData, classmatesData] = await Promise.all([
        getClassCourse(cls.id).catch(() => null),
        listClassmates(cls.id).catch(() => [] as ClassStudent[]),
      ]);
      setCourse(courseData);
      setClassmates(Array.isArray(classmatesData) ? classmatesData : []);
    } finally {
      setCourseLoading(false);
      setClassmatesLoading(false);
    }
  };

  const handleResourceOpen = async (resource: ClassResource) => {
    try {
      if (resource.type === 'FILE') {
        const url = await getResourceDownloadUrl(resource.id);
        window.open(url, '_blank', 'noopener,noreferrer');
      } else if (resource.url) {
        window.open(resource.url, '_blank', 'noopener,noreferrer');
      }
      if (course?.class.id) {
        await markCompletion(course.class.id, { resourceId: resource.id });
        const refreshed = await getClassCourse(course.class.id);
        setCourse(refreshed);
      }
    } catch {
      toast.error('Could not open this resource.');
    }
  };

  const handleSubmitActivity = async (activity: ClassActivity) => {
    if (!course) return;
    const content = submissionText[activity.id]?.trim();
    if (!content) {
      toast.error('Please enter your submission.');
      return;
    }
    setSavingId(activity.id);
    try {
      await submitActivity(activity.id, { content });
      await markCompletion(course.class.id, { activityId: activity.id });
      toast.success('Submission saved.');
      setSubmissionText((prev) => ({ ...prev, [activity.id]: '' }));
      const refreshed = await getClassCourse(course.class.id);
      setCourse(refreshed);
    } catch {
      toast.error('Failed to submit activity.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading your classes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
          Lớp của tôi
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Các lớp bạn đang tham gia. Chọn một lớp để xem nội dung và bài thi.
        </p>
      </div>

      {classes.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-700">
              Bạn chưa tham gia lớp nào.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Khi giáo viên thêm bạn vào lớp, lớp sẽ hiển thị ở đây.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              isSelected={selectedClass?.id === cls.id}
              onOpen={() => openCourse(cls)}
            />
          ))}
        </div>
      )}

      {selectedClass && (
        <div className="grid grid-cols-1 gap-5 animate-fade-in-up lg:grid-cols-12">
          <div className="lg:col-span-5 lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-7rem)] lg:min-h-[520px]">
            <StudentRosterList
              selectedClass={selectedClass}
              students={classmates}
              loading={classmatesLoading}
            />
          </div>

          <div className="lg:col-span-7">
            <Card padding="lg">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div role="tablist" className="inline-flex rounded-2xl bg-[var(--color-bg-muted)] p-1">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'course'}
                    onClick={() => setActiveTab('course')}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all duration-150 ${
                      activeTab === 'course'
                        ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    Nội dung khóa học
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'exams'}
                    onClick={() => setActiveTab('exams')}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all duration-150 ${
                      activeTab === 'exams'
                        ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    Bài thi
                  </button>
                </div>
              </div>

              {activeTab === 'course' ? (
                courseLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner size="md" label="Loading class content" />
                  </div>
                ) : course ? (
                  <StudentCourseContent
                    course={course}
                    submissionText={submissionText}
                    savingId={savingId}
                    onResourceOpen={handleResourceOpen}
                    onSubmissionChange={(activityId, value) =>
                      setSubmissionText((prev) => ({ ...prev, [activityId]: value }))
                    }
                    onSubmitActivity={handleSubmitActivity}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                    Không tải được nội dung lớp.
                  </p>
                )
              ) : (
                <StudentClassExamsTab selectedClass={selectedClass} />
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassCard({
  cls,
  isSelected,
  onOpen,
}: {
  cls: EnrolledClass;
  isSelected: boolean;
  onOpen: () => void;
}) {
  const enrolledLabel = cls.enrolledAt
    ? new Date(cls.enrolledAt).toLocaleDateString()
    : null;

  return (
    <Card padding="none" className={`overflow-hidden transition-all ${isSelected ? 'ring-2 ring-[var(--color-primary-soft-strong)]' : ''}`}>
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-indigo-700" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 truncate">
              {cls.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Grade {cls.gradeLevel}
            </p>
          </div>
          {cls.subject && (
            <Badge variant="info">{cls.subject.name}</Badge>
          )}
        </div>

        <div className="space-y-2 text-sm">
          {cls.teacher && (
            <InfoRow
              icon={iconUser}
              label="Giáo viên"
              value={cls.teacher.fullName}
            />
          )}
          {cls.semester && (
            <InfoRow
              icon={iconCalendar}
              label="Học kỳ"
              value={
                cls.semester.academicYear
                  ? `${cls.semester.name} • ${cls.semester.academicYear.name}`
                  : cls.semester.name
              }
            />
          )}
          {typeof cls._count?.classStudents === 'number' && (
            <InfoRow
              icon={iconGroup}
              label="Sĩ số"
              value={`${cls._count.classStudents}`}
            />
          )}
          {enrolledLabel && (
            <InfoRow icon={iconClock} label="Tham gia" value={enrolledLabel} />
          )}
        </div>
        <Button variant={isSelected ? 'outline' : 'primary'} size="sm" onClick={onOpen}>
          {isSelected ? 'Đóng' : 'Mở lớp'}
        </Button>
      </div>
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-slate-600">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </span>
      <span className="text-xs font-medium text-slate-500 w-20">{label}</span>
      <span className="text-sm font-medium text-slate-800 truncate">
        {value}
      </span>
    </div>
  );
}

type StudentSubmission = NonNullable<ClassCourseOverview['mySubmissions']>[number];

function StudentCourseContent({
  course,
  submissionText,
  savingId,
  onResourceOpen,
  onSubmissionChange,
  onSubmitActivity,
}: {
  course: ClassCourseOverview;
  submissionText: Record<number, string>;
  savingId: number | null;
  onResourceOpen: (resource: ClassResource) => void;
  onSubmissionChange: (activityId: number, value: string) => void;
  onSubmitActivity: (activity: ClassActivity) => void;
}) {
  const completedResources = new Set(
    course.myCompletions?.filter((c) => c.resourceId).map((c) => c.resourceId) ?? [],
  );
  const submissions = new Map<number, StudentSubmission>(
    course.mySubmissions?.map((s) => [s.activityId, s]) ?? [],
  );

  const isEmpty =
    course.sections.length === 0 &&
    course.standaloneResources.length === 0 &&
    course.standaloneActivities.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
          Tài liệu và hoạt động
        </h3>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          Mở tài liệu, nộp bài và xem feedback từ giáo viên
        </p>
      </div>

      {course.standaloneResources.length > 0 || course.standaloneActivities.length > 0 ? (
        <StudentCourseBlock
          title="Chung"
          resources={course.standaloneResources}
          activities={course.standaloneActivities}
          completedResources={completedResources}
          submissions={submissions}
          submissionText={submissionText}
          savingId={savingId}
          onResourceOpen={onResourceOpen}
          onSubmissionChange={onSubmissionChange}
          onSubmitActivity={onSubmitActivity}
        />
      ) : null}

      {isEmpty ? (
        <p className="rounded-xl border-2 border-dashed border-[var(--color-border)] py-10 text-center text-sm text-[var(--color-text-muted)]">
          Lớp chưa có tài liệu nào được xuất bản.
        </p>
      ) : (
        course.sections.map((section) => (
          <StudentCourseBlock
            key={section.id}
            title={section.title}
            subtitle={section.description}
            resources={section.resources}
            activities={section.activities}
            completedResources={completedResources}
            submissions={submissions}
            submissionText={submissionText}
            savingId={savingId}
            onResourceOpen={onResourceOpen}
            onSubmissionChange={onSubmissionChange}
            onSubmitActivity={onSubmitActivity}
          />
        ))
      )}
    </div>
  );
}

function StudentCourseBlock({
  title,
  subtitle,
  resources,
  activities,
  completedResources,
  submissions,
  submissionText,
  savingId,
  onResourceOpen,
  onSubmissionChange,
  onSubmitActivity,
}: {
  title: string;
  subtitle?: string | null;
  resources: ClassResource[];
  activities: ClassActivity[];
  completedResources: Set<number | null>;
  submissions: Map<number, StudentSubmission>;
  submissionText: Record<number, string>;
  savingId: number | null;
  onResourceOpen: (resource: ClassResource) => void;
  onSubmissionChange: (activityId: number, value: string) => void;
  onSubmitActivity: (activity: ClassActivity) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-3">
        <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{title}</h4>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
      </div>
      <div className="space-y-4">
        {resources.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Tài liệu</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {resources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2 text-left transition-colors hover:border-[var(--color-border)]"
                  onClick={() => onResourceOpen(resource)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{resource.title}</span>
                    <Badge variant={completedResources.has(resource.id) ? 'success' : 'info'} size="sm">
                      {completedResources.has(resource.id) ? 'Đã xem' : resource.type}
                    </Badge>
                  </div>
                  {resource.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">{resource.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {activities.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Hoạt động</p>
            <div className="space-y-3">
              {activities.map((activity) => {
                const submission = submissions.get(activity.id);
                const canSubmit = !['FORUM', 'ATTENDANCE'].includes(activity.type);
                return (
                  <div key={activity.id} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{activity.title}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {activity.dueAt ? `Hạn ${new Date(activity.dueAt).toLocaleString()}` : 'Không có hạn'}
                        </p>
                      </div>
                      <Badge variant={submission ? 'success' : 'info'} size="sm">
                        {submission ? submission.status : activity.type}
                      </Badge>
                    </div>
                    {activity.instructions && (
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{activity.instructions}</p>
                    )}
                    {submission?.score !== null && submission?.score !== undefined && activity.showGrades && (
                      <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">
                        Điểm: {submission.score}
                        {submission.feedback ? ` - ${submission.feedback}` : ''}
                      </p>
                    )}
                    {canSubmit && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft-strong)]"
                          rows={3}
                          placeholder="Nội dung bài nộp"
                          value={submissionText[activity.id] ?? ''}
                          onChange={(e) => onSubmissionChange(activity.id, e.target.value)}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={savingId === activity.id}
                          onClick={() => onSubmitActivity(activity)}
                        >
                          Nộp bài
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const iconUser = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const iconCalendar = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const iconGroup = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM7 12a3 3 0 100-6 3 3 0 000 6z" />
  </svg>
);

const iconClock = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
