import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import {
  getClassCourse,
  getResourceDownloadUrl,
  listMyClasses,
  markCompletion,
  submitActivity,
} from '@/services/class.api';
import type { ClassActivity, ClassCourseOverview, ClassItem, ClassResource } from '@/types/exam';

type EnrolledClass = ClassItem & { enrolledAt?: string };

export default function MyClassesPage() {
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<ClassCourseOverview | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [submissionText, setSubmissionText] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

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

  const openCourse = async (classId: number) => {
    setCourseLoading(true);
    try {
      const data = await getClassCourse(classId);
      setCourse(data);
    } catch {
      toast.error('Failed to load class content.');
    } finally {
      setCourseLoading(false);
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
        openCourse(course.class.id);
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
      openCourse(course.class.id);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Classes</h1>
        <p className="mt-1 text-sm text-slate-500">
          All the classes you are currently enrolled in.
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
              You are not enrolled in any class yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Once a teacher adds you to a class, it will appear here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} onOpen={() => openCourse(cls.id)} />
          ))}
        </div>
      )}

      {courseLoading && (
        <Card padding="lg">
          <div className="flex justify-center py-10">
            <Spinner size="md" label="Loading class content" />
          </div>
        </Card>
      )}

      {course && !courseLoading && (
        <StudentCoursePanel
          course={course}
          submissionText={submissionText}
          savingId={savingId}
          onResourceOpen={handleResourceOpen}
          onSubmissionChange={(activityId, value) =>
            setSubmissionText((prev) => ({ ...prev, [activityId]: value }))
          }
          onSubmitActivity={handleSubmitActivity}
        />
      )}
    </div>
  );
}

function ClassCard({ cls, onOpen }: { cls: EnrolledClass; onOpen: () => void }) {
  const enrolledLabel = cls.enrolledAt
    ? new Date(cls.enrolledAt).toLocaleDateString()
    : null;

  return (
    <Card padding="none" className="overflow-hidden transition-shadow hover:shadow-md">
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
              label="Teacher"
              value={cls.teacher.fullName}
            />
          )}
          {cls.semester && (
            <InfoRow
              icon={iconCalendar}
              label="Semester"
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
              label="Students"
              value={`${cls._count.classStudents}`}
            />
          )}
          {enrolledLabel && (
            <InfoRow icon={iconClock} label="Joined" value={enrolledLabel} />
          )}
        </div>
        <Button variant="primary" size="sm" onClick={onOpen}>
          Open Class
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

// ── Icons ─────────────────────────────────────────────

type StudentSubmission = NonNullable<ClassCourseOverview['mySubmissions']>[number];

function StudentCoursePanel({
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

  return (
    <Card padding="lg">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">{course.class.name}</h2>
        <p className="text-sm text-slate-500">Materials, activities, submissions, and feedback</p>
      </div>
      <div className="space-y-4">
        {course.standaloneResources.length > 0 || course.standaloneActivities.length > 0 ? (
          <StudentCourseBlock
            title="General"
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
        {course.sections.length === 0 &&
        course.standaloneResources.length === 0 &&
        course.standaloneActivities.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
            No published materials yet.
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
    </Card>
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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="space-y-4">
        {resources.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Materials</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {resources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100"
                  onClick={() => onResourceOpen(resource)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{resource.title}</span>
                    <Badge variant={completedResources.has(resource.id) ? 'success' : 'info'}>
                      {completedResources.has(resource.id) ? 'Done' : resource.type}
                    </Badge>
                  </div>
                  {resource.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{resource.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {activities.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Activities</p>
            <div className="space-y-3">
              {activities.map((activity) => {
                const submission = submissions.get(activity.id);
                const canSubmit = !['FORUM', 'ATTENDANCE'].includes(activity.type);
                return (
                  <div key={activity.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{activity.title}</p>
                        <p className="text-xs text-slate-500">
                          {activity.dueAt ? `Due ${new Date(activity.dueAt).toLocaleString()}` : 'No deadline'}
                        </p>
                      </div>
                      <Badge variant={submission ? 'success' : 'info'}>
                        {submission ? submission.status : activity.type}
                      </Badge>
                    </div>
                    {activity.instructions && (
                      <p className="mt-2 text-sm text-slate-600">{activity.instructions}</p>
                    )}
                    {submission?.score !== null && submission?.score !== undefined && activity.showGrades && (
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        Score: {submission.score}
                        {submission.feedback ? ` - ${submission.feedback}` : ''}
                      </p>
                    )}
                    {canSubmit && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          rows={3}
                          placeholder="Your submission"
                          value={submissionText[activity.id] ?? ''}
                          onChange={(e) => onSubmissionChange(activity.id, e.target.value)}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={savingId === activity.id}
                          onClick={() => onSubmitActivity(activity)}
                        >
                          Submit
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
