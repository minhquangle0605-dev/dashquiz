-- Phase 5/6 of the timetable feature: per-class exam schedules + room/proctor.
-- All columns are nullable so existing global schedules (class_id IS NULL) keep
-- behaving exactly as before. Written idempotently for safe re-application.

ALTER TABLE "exam_schedules" ADD COLUMN IF NOT EXISTS "class_id" INTEGER;
ALTER TABLE "exam_schedules" ADD COLUMN IF NOT EXISTS "room" VARCHAR(50);
ALTER TABLE "exam_schedules" ADD COLUMN IF NOT EXISTS "proctor_id" INTEGER;

DO $$ BEGIN
  ALTER TABLE "exam_schedules"
    ADD CONSTRAINT "exam_schedules_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "exam_schedules"
    ADD CONSTRAINT "exam_schedules_proctor_id_fkey"
    FOREIGN KEY ("proctor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "exam_schedules_class_id_idx" ON "exam_schedules"("class_id");
CREATE INDEX IF NOT EXISTS "exam_schedules_proctor_id_idx" ON "exam_schedules"("proctor_id");
