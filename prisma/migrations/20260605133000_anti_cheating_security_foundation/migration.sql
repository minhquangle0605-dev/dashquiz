-- Anti-cheating MVP foundation.
-- Keeps raw exam_attempt_events immutable and adds scored, reviewable evidence
-- tables for teacher-facing proctoring workflows.

ALTER TYPE "ExamAttemptEventType" ADD VALUE IF NOT EXISTS 'FULLSCREEN_EXITED';
ALTER TYPE "ExamAttemptEventType" ADD VALUE IF NOT EXISTS 'FULLSCREEN_RESTORED';
ALTER TYPE "ExamAttemptEventType" ADD VALUE IF NOT EXISTS 'CUT';
ALTER TYPE "ExamAttemptEventType" ADD VALUE IF NOT EXISTS 'CAMERA_PERMISSION_MISSING';
ALTER TYPE "ExamAttemptEventType" ADD VALUE IF NOT EXISTS 'DEVICE_CHANGED';

DO $$ BEGIN
  CREATE TYPE "ExamSecurityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'LOCKDOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SecurityRiskLevel" AS ENUM ('LOW', 'WATCH', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SecuritySessionStatus" AS ENUM ('ACTIVE', 'STALE', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ViolationReviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FALSE_POSITIVE', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProctorReviewDecision" AS ENUM ('NO_ACTION', 'WATCH', 'FLAGGED', 'CLEARED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "exam_security_settings" (
  "id" SERIAL NOT NULL,
  "exam_id" INTEGER NOT NULL,
  "security_level" "ExamSecurityLevel" NOT NULL DEFAULT 'MEDIUM',
  "require_fullscreen" BOOLEAN NOT NULL DEFAULT true,
  "block_copy_paste" BOOLEAN NOT NULL DEFAULT true,
  "block_right_click" BOOLEAN NOT NULL DEFAULT true,
  "block_shortcuts" BOOLEAN NOT NULL DEFAULT true,
  "require_camera" BOOLEAN NOT NULL DEFAULT false,
  "require_pre_check" BOOLEAN NOT NULL DEFAULT true,
  "allowed_ip_ranges" JSONB,
  "max_devices" SMALLINT NOT NULL DEFAULT 1,
  "allow_resume" BOOLEAN NOT NULL DEFAULT true,
  "warning_threshold" INTEGER NOT NULL DEFAULT 15,
  "auto_submit_threshold" INTEGER DEFAULT 100,
  "snapshot_interval_sec" INTEGER,
  "retention_days" INTEGER NOT NULL DEFAULT 30,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_security_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_security_settings_exam_id_key" UNIQUE ("exam_id"),
  CONSTRAINT "exam_security_settings_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "attempt_security_sessions" (
  "id" SERIAL NOT NULL,
  "attempt_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "device_id" VARCHAR(191) NOT NULL,
  "user_agent" TEXT,
  "ip_address" VARCHAR(64),
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_heartbeat_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fullscreen_state" BOOLEAN NOT NULL DEFAULT false,
  "camera_permission" VARCHAR(30),
  "screen_size" VARCHAR(40),
  "status" "SecuritySessionStatus" NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "attempt_security_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attempt_security_sessions_attempt_id_key" UNIQUE ("attempt_id"),
  CONSTRAINT "attempt_security_sessions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attempt_security_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "attempt_violations" (
  "id" SERIAL NOT NULL,
  "attempt_id" INTEGER NOT NULL,
  "event_id" INTEGER,
  "event_type" "ExamAttemptEventType" NOT NULL,
  "severity" "SecuritySeverity" NOT NULL,
  "risk_points" INTEGER NOT NULL,
  "message" VARCHAR(255) NOT NULL,
  "metadata" JSONB,
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by" INTEGER,
  "review_status" "ViolationReviewStatus" NOT NULL DEFAULT 'PENDING',
  "teacher_note" TEXT,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attempt_violations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attempt_violations_event_id_key" UNIQUE ("event_id"),
  CONSTRAINT "attempt_violations_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attempt_violations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "exam_attempt_events"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "attempt_violations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "proctor_reviews" (
  "id" SERIAL NOT NULL,
  "attempt_id" INTEGER NOT NULL,
  "reviewer_id" INTEGER NOT NULL,
  "decision" "ProctorReviewDecision" NOT NULL DEFAULT 'WATCH',
  "final_risk_level" "SecurityRiskLevel" NOT NULL DEFAULT 'WATCH',
  "summary" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proctor_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "proctor_reviews_attempt_id_key" UNIQUE ("attempt_id"),
  CONSTRAINT "proctor_reviews_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "proctor_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "exam_security_policy_templates" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "settings_json" JSONB NOT NULL,
  "created_by" INTEGER,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_security_policy_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_security_policy_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "attempt_security_sessions_student_id_idx" ON "attempt_security_sessions"("student_id");
CREATE INDEX IF NOT EXISTS "attempt_security_sessions_status_last_heartbeat_at_idx" ON "attempt_security_sessions"("status", "last_heartbeat_at");
CREATE INDEX IF NOT EXISTS "attempt_violations_attempt_id_occurred_at_idx" ON "attempt_violations"("attempt_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "attempt_violations_severity_review_status_idx" ON "attempt_violations"("severity", "review_status");
CREATE INDEX IF NOT EXISTS "attempt_violations_event_type_occurred_at_idx" ON "attempt_violations"("event_type", "occurred_at");
CREATE INDEX IF NOT EXISTS "proctor_reviews_reviewer_id_idx" ON "proctor_reviews"("reviewer_id");
CREATE INDEX IF NOT EXISTS "exam_security_policy_templates_created_by_idx" ON "exam_security_policy_templates"("created_by");
