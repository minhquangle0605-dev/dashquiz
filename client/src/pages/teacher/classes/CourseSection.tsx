import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import type { ClassCourseOverview, ClassResource, ClassSection } from '@/types/exam';

import { CourseBlock } from './CourseBlock';

interface CourseSectionProps {
  course: ClassCourseOverview | null;
  loading: boolean;
  onAddSection: () => void;
  onAddResource: () => void;
  onAddActivity: () => void;
  deletingSectionId?: number | null;
  deletingResourceId?: number | null;
  onDeleteSection?: (section: ClassSection) => void;
  onOpenResource?: (resource: ClassResource) => void;
  onDeleteResource?: (resource: ClassResource) => void;
}

export function CourseSection({
  course,
  loading,
  onAddSection,
  onAddResource,
  onAddActivity,
  deletingSectionId,
  deletingResourceId,
  onDeleteSection,
  onOpenResource,
  onDeleteResource,
}: CourseSectionProps) {
  const hasContent =
    course &&
    (course.sections.length > 0 ||
      course.standaloneResources.length > 0 ||
      course.standaloneActivities.length > 0);

  return (
    <Card padding="lg">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
            Course Content
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Sections, resources, activities, and submissions
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
              deletingResourceId={deletingResourceId}
              onOpenResource={onOpenResource}
              onDeleteResource={onDeleteResource}
            />
          )}
          {!hasContent ? (
            <p className="rounded-xl border-2 border-dashed border-[var(--color-border)] py-10 text-center text-sm text-[var(--color-text-muted)]">
              No content yet. Add the first section to get started.
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
                deletingSection={deletingSectionId === section.id}
                deletingResourceId={deletingResourceId}
                onDeleteSection={
                  onDeleteSection ? () => onDeleteSection(section) : undefined
                }
                onOpenResource={onOpenResource}
                onDeleteResource={onDeleteResource}
              />
            ))
          )}
        </div>
      )}
    </Card>
  );
}
