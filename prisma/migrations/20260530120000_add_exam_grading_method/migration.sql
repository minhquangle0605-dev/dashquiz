-- Phase 1 (§5): final-grade method for multi-attempt exams.
-- Adds GradingMethod enum + exams.grading_method (default HIGHEST = old behaviour).
-- Written idempotent so it is safe to re-run / apply over a partially-migrated DB.

DO $$ BEGIN
  CREATE TYPE "GradingMethod" AS ENUM ('HIGHEST', 'AVERAGE', 'FIRST', 'LAST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "exams"
  ADD COLUMN IF NOT EXISTS "grading_method" "GradingMethod" NOT NULL DEFAULT 'HIGHEST';
