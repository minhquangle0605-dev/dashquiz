import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { ClassCourseOverview } from '@/types/exam';

import { CourseBlock } from './CourseBlock';

interface CourseSectionInlineProps {
  course: ClassCourseOverview | null;
  loading: boolean;
  onAddSection: () => void;
  onAddResource: () => void;
  onAddActivity: () => void;
}

export function CourseSectionInline({
  course,
  loading,
  onAddSection,
  onAddResource,
  onAddActivity,
}: CourseSectionInlineProps) {
  const hasContent =
    course &&
    (course.sections.length > 0 ||
      course.standaloneResources.length > 0 ||
      course.standaloneActivities.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
            Nội dung khóa học
          </h3>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            Sections, tài liệu, hoạt động và bài nộp
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onAddSection}>
            + Section
          </Button>
          <Button variant="outline" size="sm" onClick={onAddResource}>
            + Resource
          </Button>
          <Button variant="primary" size="sm" onClick={onAddActivity}>
            + Activity
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="md" label="Loading course" />
        </div>
      ) : !course ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          No course content loaded.
        </p>
      ) : (
        <div className="space-y-4">
          {(course.standaloneResources.length > 0 ||
            course.standaloneActivities.length > 0) && (
            <CourseBlock
              title="General"
              resources={course.standaloneResources}
              activities={course.standaloneActivities}
            />
          )}
          {!hasContent ? (
            <p className="rounded-xl border-2 border-dashed border-[var(--color-border)] py-10 text-center text-sm text-[var(--color-text-muted)]">
              Chưa có nội dung. Thêm section đầu tiên để bắt đầu.
            </p>
          ) : (
            course.sections.map((section) => (
              <CourseBlock
                key={section.id}
                title={section.title}
                subtitle={section.description}
                resources={section.resources}
                activities={section.activities}
                hidden={!section.isPublished}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
