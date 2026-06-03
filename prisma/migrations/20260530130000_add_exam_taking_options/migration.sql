-- Phase 2 (§7 + §9): exam-taking configuration.
--   shuffle_answers   : randomise option order per attempt
--   navigation_mode   : FREE (default, old behaviour) | SEQUENTIAL
--   questions_per_page : null = 1 question per page (old behaviour)
--   access_password    : optional quiz password gate
-- All defaults preserve current behaviour. Written idempotent.

DO $$ BEGIN
  CREATE TYPE "NavigationMode" AS ENUM ('FREE', 'SEQUENTIAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "exams"
  ADD COLUMN IF NOT EXISTS "shuffle_answers" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "exams"
  ADD COLUMN IF NOT EXISTS "navigation_mode" "NavigationMode" NOT NULL DEFAULT 'FREE';

ALTER TABLE "exams"
  ADD COLUMN IF NOT EXISTS "questions_per_page" INTEGER;

ALTER TABLE "exams"
  ADD COLUMN IF NOT EXISTS "access_password" VARCHAR(100);
