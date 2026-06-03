-- Vietnamese MOET-style gradebook (Thông tư 22).
-- Replaces the earlier weight-based GradeCategory model with three fixed
-- component types (ĐGtx / ĐGgk / ĐGck) and adds per-student grade entries
-- plus a full change-history audit table.

-- 1. Enum types
DO $$ BEGIN
  CREATE TYPE "GradeComponentType" AS ENUM ('REGULAR', 'MIDTERM', 'FINAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "GradeEntrySource" AS ENUM ('EXAM', 'ACTIVITY', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Drop legacy FK columns + grade_categories table if leftover from earlier dev runs
ALTER TABLE "class_activities" DROP COLUMN IF EXISTS "grade_category_id";
ALTER TABLE "exam_assignments" DROP COLUMN IF EXISTS "grade_category_id";
DROP TABLE IF EXISTS "grade_categories";

-- 3. New component columns
ALTER TABLE "class_activities"
  ADD COLUMN IF NOT EXISTS "grade_component_type" "GradeComponentType";

ALTER TABLE "exam_assignments"
  ADD COLUMN IF NOT EXISTS "grade_component_type" "GradeComponentType";

CREATE INDEX IF NOT EXISTS "class_activities_grade_component_idx"
  ON "class_activities"("grade_component_type");

CREATE INDEX IF NOT EXISTS "exam_assignments_grade_component_idx"
  ON "exam_assignments"("grade_component_type");

-- 4. Class.linkedClassId — pair HK1 with HK2 for ĐTBmcn (year-average) calculation
ALTER TABLE "classes"
  ADD COLUMN IF NOT EXISTS "linked_class_id" INTEGER;

DO $$ BEGIN
  ALTER TABLE "classes"
    ADD CONSTRAINT "classes_linked_class_fkey"
    FOREIGN KEY ("linked_class_id") REFERENCES "classes"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "classes_linked_class_idx" ON "classes"("linked_class_id");

-- 5. Per-student grade entries (auto from exam/activity OR manually entered by teacher)
CREATE TABLE IF NOT EXISTS "student_grades" (
  "id" SERIAL NOT NULL,
  "class_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "component_type" "GradeComponentType" NOT NULL,
  "source" "GradeEntrySource" NOT NULL DEFAULT 'MANUAL',
  "label" VARCHAR(200),
  "score" DECIMAL(4, 2) NOT NULL,
  "exam_assignment_id" INTEGER,
  "class_activity_id" INTEGER,
  "recorded_by" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_grades_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_grades_class_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE,
  CONSTRAINT "student_grades_student_fkey"
    FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "student_grades_exam_assignment_fkey"
    FOREIGN KEY ("exam_assignment_id") REFERENCES "exam_assignments"("id") ON DELETE SET NULL,
  CONSTRAINT "student_grades_class_activity_fkey"
    FOREIGN KEY ("class_activity_id") REFERENCES "class_activities"("id") ON DELETE SET NULL,
  CONSTRAINT "student_grades_recorder_fkey"
    FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_grades_student_exam_assignment_id_key"
  ON "student_grades"("student_id", "exam_assignment_id");

CREATE UNIQUE INDEX IF NOT EXISTS "student_grades_student_class_activity_id_key"
  ON "student_grades"("student_id", "class_activity_id");

CREATE INDEX IF NOT EXISTS "student_grades_class_component_idx"
  ON "student_grades"("class_id", "component_type");

CREATE INDEX IF NOT EXISTS "student_grades_class_student_idx"
  ON "student_grades"("class_id", "student_id");

-- 6. Change history — every create / update / delete touches this table
CREATE TABLE IF NOT EXISTS "student_grade_changes" (
  "id" SERIAL NOT NULL,
  "student_grade_id" INTEGER NOT NULL,
  "changed_by" INTEGER NOT NULL,
  "old_score" DECIMAL(4, 2),
  "new_score" DECIMAL(4, 2),
  "old_component_type" "GradeComponentType",
  "new_component_type" "GradeComponentType",
  "action" VARCHAR(20) NOT NULL,
  "reason" TEXT,
  "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_grade_changes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_grade_changes_entry_fkey"
    FOREIGN KEY ("student_grade_id") REFERENCES "student_grades"("id") ON DELETE CASCADE,
  CONSTRAINT "student_grade_changes_user_fkey"
    FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "student_grade_changes_entry_time_idx"
  ON "student_grade_changes"("student_grade_id", "changed_at");
