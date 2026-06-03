-- Class weekly timetable (Phase 1 of the timetable / exam-conflict feature).
-- Stores every timetable cell for viewing; only Mathematics/Physics/Chemistry slots
-- (kind = MANAGED_SUBJECT, subject_id set) participate in exam-schedule conflict checks.
-- Written idempotently so it is safe to re-apply against a partially-migrated database.

-- 1. Enum types
DO $$ BEGIN
  CREATE TYPE "TimetableSlotKind" AS ENUM ('MANAGED_SUBJECT', 'DISPLAY_ONLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TimetableSlotStatus" AS ENUM ('ACTIVE', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS "class_timetable_slots" (
  "id"             SERIAL NOT NULL,
  "class_id"       INTEGER NOT NULL,
  "semester_id"    INTEGER,
  "subject_id"     INTEGER,
  "display_name"   VARCHAR(100) NOT NULL,
  "kind"           "TimetableSlotKind" NOT NULL DEFAULT 'DISPLAY_ONLY',
  "status"         "TimetableSlotStatus" NOT NULL DEFAULT 'ACTIVE',
  "day_of_week"    SMALLINT NOT NULL,
  "period_index"   SMALLINT NOT NULL,
  "start_minute"   INTEGER NOT NULL,
  "end_minute"     INTEGER NOT NULL,
  "room"           VARCHAR(50),
  "note"           VARCHAR(255),
  "effective_from" DATE,
  "effective_to"   DATE,
  "created_by"     INTEGER NOT NULL,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_timetable_slots_pkey" PRIMARY KEY ("id")
);

-- 3. Foreign keys
DO $$ BEGIN
  ALTER TABLE "class_timetable_slots"
    ADD CONSTRAINT "class_timetable_slots_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "class_timetable_slots"
    ADD CONSTRAINT "class_timetable_slots_semester_id_fkey"
    FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "class_timetable_slots"
    ADD CONSTRAINT "class_timetable_slots_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "class_timetable_slots"
    ADD CONSTRAINT "class_timetable_slots_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS "class_timetable_slots_class_id_day_of_week_period_index_idx"
  ON "class_timetable_slots"("class_id", "day_of_week", "period_index");

CREATE INDEX IF NOT EXISTS "class_timetable_slots_class_id_day_of_week_start_minute_end_idx"
  ON "class_timetable_slots"("class_id", "day_of_week", "start_minute", "end_minute");

CREATE INDEX IF NOT EXISTS "class_timetable_slots_subject_id_idx"
  ON "class_timetable_slots"("subject_id");
