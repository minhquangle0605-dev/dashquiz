-- Phase 3 (§8): granular review options per time window.
-- review_options is a JSON blob; NULL falls back to the legacy show_result flag,
-- so existing exams keep their current behaviour. Idempotent.

ALTER TABLE "exams"
  ADD COLUMN IF NOT EXISTS "review_options" JSONB;
