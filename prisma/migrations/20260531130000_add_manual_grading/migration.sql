-- Phase 4 (§12): manual grading support on attempt answers.
-- Lets a teacher override the score of a question (e.g. SHORT_ANSWER essays).
-- Effective answer score = manual_score when set, else is_correct ? points : 0.
-- All columns nullable, so existing answers keep their auto-graded behaviour.

ALTER TABLE "attempt_answers"
  ADD COLUMN IF NOT EXISTS "manual_score" DECIMAL;

ALTER TABLE "attempt_answers"
  ADD COLUMN IF NOT EXISTS "manual_feedback" TEXT;

ALTER TABLE "attempt_answers"
  ADD COLUMN IF NOT EXISTS "graded_by" INTEGER;

ALTER TABLE "attempt_answers"
  ADD COLUMN IF NOT EXISTS "graded_at" TIMESTAMPTZ;
