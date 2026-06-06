-- Phase 4: duplicate detection foundation (PDF §10/§12/§14).
-- Adds a normalized text column + trigram index for fuzzy similarity search,
-- a per-preview-item duplicate cache, and a table that records reviewed
-- duplicate decisions so confirmed-acceptable variations stop re-flagging.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Normalized question text (HTML stripped, lowercased, whitespace collapsed). The
-- JS normalizer in questionDedup.service mirrors this so new rows match the backfill.
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "normalized_content" TEXT;

UPDATE "questions"
SET "normalized_content" = trim(
  regexp_replace(
    regexp_replace(
      regexp_replace(lower("content"), '<[^>]+>', ' ', 'g'),
      '&[a-z]+;', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  )
)
WHERE "normalized_content" IS NULL;

CREATE INDEX IF NOT EXISTS "questions_normalized_content_trgm_idx"
  ON "questions" USING gin ("normalized_content" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "questions_subject_chapter_idx"
  ON "questions" ("subject_id", "chapter_id");

-- Cache of possible duplicates found for each extracted preview item:
-- { matches: [{ questionId, similarity, method, contentPreview, questionType }] }.
ALTER TABLE "import_preview_items" ADD COLUMN IF NOT EXISTS "duplicate_json" JSONB;

-- Reviewed duplicate decisions between two existing bank questions.
CREATE TABLE IF NOT EXISTS "question_duplicate_links" (
  "id" SERIAL NOT NULL,
  "question_id" INTEGER NOT NULL,
  "duplicate_question_id" INTEGER NOT NULL,
  "similarity" DOUBLE PRECISION NOT NULL,
  "method" VARCHAR(20) NOT NULL DEFAULT 'trigram',
  "status" VARCHAR(20) NOT NULL DEFAULT 'flagged',
  "reviewed_by" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_duplicate_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_duplicate_links_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_duplicate_links_duplicate_question_id_fkey" FOREIGN KEY ("duplicate_question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "question_duplicate_links_pair_key"
  ON "question_duplicate_links" ("question_id", "duplicate_question_id");
CREATE INDEX IF NOT EXISTS "question_duplicate_links_status_idx"
  ON "question_duplicate_links" ("status");
