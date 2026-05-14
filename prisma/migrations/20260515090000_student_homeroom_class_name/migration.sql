-- AlterTable
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "homeroom_class_name" VARCHAR(20);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "students_homeroom_class_name_idx" ON "students" ("homeroom_class_name");

-- Backfill from already-linked homeroom Class (if any)
UPDATE "students" s
SET "homeroom_class_name" = c."name"
FROM "classes" c
WHERE s."class_id" = c."id" AND s."homeroom_class_name" IS NULL;
