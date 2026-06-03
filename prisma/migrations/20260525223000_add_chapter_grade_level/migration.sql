ALTER TABLE "chapters"
ADD COLUMN "grade_level" SMALLINT NOT NULL DEFAULT 10;

CREATE INDEX "chapters_subject_id_grade_level_order_index_idx"
ON "chapters"("subject_id", "grade_level", "order_index");
