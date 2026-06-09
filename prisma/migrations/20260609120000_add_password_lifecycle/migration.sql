-- Password lifecycle: force temporary-password change after first login.
-- Idempotent (IF NOT EXISTS) to stay safe under the project's db-push workflow.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMPTZ;

-- Backfill: existing accounts must change their password on next login.
UPDATE "users" SET "must_change_password" = true WHERE "password_changed_at" IS NULL;
