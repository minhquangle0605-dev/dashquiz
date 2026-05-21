DO $$ BEGIN
  CREATE TYPE "ExamAttemptEventType" AS ENUM (
    'STARTED',
    'RESUMED',
    'HEARTBEAT',
    'ANSWER_SAVED',
    'TAB_HIDDEN',
    'WINDOW_BLUR',
    'COPY',
    'PASTE',
    'CONTEXT_MENU',
    'SHORTCUT_BLOCKED',
    'OFFLINE',
    'ONLINE',
    'SUBMITTED',
    'AUTO_SUBMITTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "exam_attempt_events" (
  "id" SERIAL NOT NULL,
  "attempt_id" INTEGER NOT NULL,
  "type" "ExamAttemptEventType" NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "client_elapsed_sec" INTEGER,
  "question_id" INTEGER,
  "metadata" JSONB,
  CONSTRAINT "exam_attempt_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_attempt_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "exam_attempt_events_attempt_id_occurred_at_idx" ON "exam_attempt_events"("attempt_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "exam_attempt_events_attempt_id_type_idx" ON "exam_attempt_events"("attempt_id", "type");
CREATE INDEX IF NOT EXISTS "exam_attempt_events_type_occurred_at_idx" ON "exam_attempt_events"("type", "occurred_at");
