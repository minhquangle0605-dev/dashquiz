-- Remove the Vietnamese MOET-style gradebook feature entirely.
-- Drops the per-student grade tables, the grade-component columns that fed
-- them, the HK1<->HK2 class link, and the now-unused enum types.
-- Written idempotently (IF EXISTS) so it is safe to re-run.

-- 1. Grade entry tables (child first to respect the FK).
DROP TABLE IF EXISTS "student_grade_changes";
DROP TABLE IF EXISTS "student_grades";

-- 2. Grade-component columns on exams/activities (their indexes drop with them).
ALTER TABLE "class_activities" DROP COLUMN IF EXISTS "grade_component_type";
ALTER TABLE "exam_assignments" DROP COLUMN IF EXISTS "grade_component_type";

-- 3. HK1<->HK2 class pairing used for the year-average calculation.
ALTER TABLE "classes" DROP CONSTRAINT IF EXISTS "classes_linked_class_fkey";
DROP INDEX IF EXISTS "classes_linked_class_idx";
ALTER TABLE "classes" DROP COLUMN IF EXISTS "linked_class_id";

-- 4. Enum types (only after every column using them is gone).
DROP TYPE IF EXISTS "GradeEntrySource";
DROP TYPE IF EXISTS "GradeComponentType";
