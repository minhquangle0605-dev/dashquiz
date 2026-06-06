-- Import pipeline foundation (Phase 1 of the Import/OCR & Smart Question Bank plan).
-- Persists each upload attempt as an ImportJob so parsing can run in the background,
-- progress can be polled, the original file can be retried, and extracted questions
-- (ImportPreviewItem) are reviewed/validated before they are ever saved to the bank.

DO $$ BEGIN
  CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PARSING', 'READY', 'COMMITTING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImportPreviewItemStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'SKIPPED', 'COMMITTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "import_jobs" (
  "id" SERIAL NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "file_type" VARCHAR(100) NOT NULL,
  "source_format" VARCHAR(20) NOT NULL,
  "source_object" TEXT,
  "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "total_items" INTEGER NOT NULL DEFAULT 0,
  "valid_items" INTEGER NOT NULL DEFAULT 0,
  "invalid_items" INTEGER NOT NULL DEFAULT 0,
  "warning_count" INTEGER NOT NULL DEFAULT 0,
  "imported_count" INTEGER NOT NULL DEFAULT 0,
  "subject_id" INTEGER,
  "chapter_id" INTEGER,
  "topic_id" INTEGER,
  "parser_source" VARCHAR(20),
  "error_message" TEXT,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "import_jobs_created_by_created_at_idx" ON "import_jobs"("created_by", "created_at");
CREATE INDEX IF NOT EXISTS "import_jobs_status_idx" ON "import_jobs"("status");

CREATE TABLE IF NOT EXISTS "import_preview_items" (
  "id" SERIAL NOT NULL,
  "import_job_id" INTEGER NOT NULL,
  "order_index" INTEGER NOT NULL,
  "raw_text" TEXT,
  "normalized_json" JSONB NOT NULL,
  "validation_json" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "source_page" INTEGER,
  "source_line" INTEGER,
  "status" "ImportPreviewItemStatus" NOT NULL DEFAULT 'PENDING',
  "question_id" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_preview_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "import_preview_items_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "import_preview_items_import_job_id_order_index_idx" ON "import_preview_items"("import_job_id", "order_index");
