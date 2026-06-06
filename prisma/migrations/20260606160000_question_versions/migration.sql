-- Phase 5: question versioning (PDF §8 QuestionVersion, P2 feature).
-- Snapshots a question's content/options each time it is saved so teachers can
-- view history and restore a previous version. Existing rows are seeded as v1.

CREATE TABLE IF NOT EXISTS "question_versions" (
  "id" SERIAL NOT NULL,
  "question_id" INTEGER NOT NULL,
  "version_no" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "question_type" "QuestionKind" NOT NULL,
  "difficulty" SMALLINT NOT NULL,
  "explanation" TEXT,
  "options_json" JSONB NOT NULL,
  "changed_by" INTEGER,
  "change_reason" VARCHAR(200),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_versions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_versions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "question_versions_question_version_key"
  ON "question_versions" ("question_id", "version_no");
CREATE INDEX IF NOT EXISTS "question_versions_question_id_idx"
  ON "question_versions" ("question_id");

-- Seed v1 for every existing question from its current state.
INSERT INTO "question_versions"
  ("question_id", "version_no", "content", "question_type", "difficulty", "explanation", "options_json", "changed_by", "created_at")
SELECT
  q."id", 1, q."content", q."question_type", q."difficulty", q."explanation",
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('label', o."label", 'content', o."content", 'isCorrect', o."is_correct") ORDER BY o."label")
     FROM "question_options" o WHERE o."question_id" = q."id"),
    '[]'::jsonb
  ),
  q."created_by", q."created_at"
FROM "questions" q
WHERE NOT EXISTS (SELECT 1 FROM "question_versions" v WHERE v."question_id" = q."id");
