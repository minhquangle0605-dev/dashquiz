DO $$ BEGIN
  CREATE TYPE "ClassMemberRole" AS ENUM ('STUDENT', 'TA', 'NON_EDITING_TEACHER', 'TEACHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClassResourceType" AS ENUM ('FILE', 'VIDEO', 'LINK', 'LESSON');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClassActivityType" AS ENUM ('QUIZ', 'ASSIGNMENT', 'FORUM', 'WORKSHOP', 'ATTENDANCE', 'SURVEY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClassPublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClassSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'GRADED', 'RETURNED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "class_member_roles" (
  "class_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "role" "ClassMemberRole" NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_member_roles_pkey" PRIMARY KEY ("class_id", "user_id"),
  CONSTRAINT "class_member_roles_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_member_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "class_sections" (
  "id" SERIAL NOT NULL,
  "class_id" INTEGER NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_sections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_sections_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_sections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "class_resources" (
  "id" SERIAL NOT NULL,
  "class_id" INTEGER NOT NULL,
  "section_id" INTEGER,
  "type" "ClassResourceType" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "content" TEXT,
  "url" TEXT,
  "file_name" VARCHAR(255),
  "mime_type" VARCHAR(120),
  "file_size_bytes" INTEGER,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_resources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_resources_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_resources_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "class_resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "class_activities" (
  "id" SERIAL NOT NULL,
  "class_id" INTEGER NOT NULL,
  "section_id" INTEGER,
  "type" "ClassActivityType" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "instructions" TEXT,
  "content" TEXT,
  "status" "ClassPublishStatus" NOT NULL DEFAULT 'DRAFT',
  "due_at" TIMESTAMPTZ,
  "max_score" DOUBLE PRECISION,
  "allow_late" BOOLEAN NOT NULL DEFAULT false,
  "show_grades" BOOLEAN NOT NULL DEFAULT true,
  "allow_student_posts" BOOLEAN NOT NULL DEFAULT true,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_activities_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_activities_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "class_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "class_activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "class_submissions" (
  "id" SERIAL NOT NULL,
  "activity_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "content" TEXT,
  "file_url" TEXT,
  "file_name" VARCHAR(255),
  "status" "ClassSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "score" DOUBLE PRECISION,
  "feedback" TEXT,
  "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "graded_at" TIMESTAMPTZ,
  "graded_by" INTEGER,
  CONSTRAINT "class_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_submissions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "class_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_submissions_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "class_forum_posts" (
  "id" SERIAL NOT NULL,
  "activity_id" INTEGER NOT NULL,
  "author_id" INTEGER NOT NULL,
  "parent_id" INTEGER,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_forum_posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_forum_posts_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "class_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_forum_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_forum_posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "class_forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "class_attendance_records" (
  "activity_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "note" VARCHAR(255),
  "recorded_by" INTEGER NOT NULL,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_attendance_records_pkey" PRIMARY KEY ("activity_id", "student_id"),
  CONSTRAINT "class_attendance_records_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "class_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_attendance_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "class_completions" (
  "id" SERIAL NOT NULL,
  "class_id" INTEGER NOT NULL,
  "student_id" INTEGER NOT NULL,
  "resource_id" INTEGER,
  "activity_id" INTEGER,
  "completed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_completions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_completions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_completions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_completions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "class_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_completions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "class_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_completions_target_check" CHECK (("resource_id" IS NOT NULL AND "activity_id" IS NULL) OR ("resource_id" IS NULL AND "activity_id" IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS "class_activity_logs" (
  "id" SERIAL NOT NULL,
  "class_id" INTEGER NOT NULL,
  "actor_id" INTEGER,
  "action" VARCHAR(80) NOT NULL,
  "target_type" VARCHAR(50),
  "target_id" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_activity_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_activity_logs_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "class_activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "class_member_roles_user_id_role_idx" ON "class_member_roles"("user_id", "role");
CREATE INDEX IF NOT EXISTS "class_sections_class_id_order_index_idx" ON "class_sections"("class_id", "order_index");
CREATE INDEX IF NOT EXISTS "class_resources_class_id_section_id_order_index_idx" ON "class_resources"("class_id", "section_id", "order_index");
CREATE INDEX IF NOT EXISTS "class_resources_type_idx" ON "class_resources"("type");
CREATE INDEX IF NOT EXISTS "class_activities_class_id_section_id_status_idx" ON "class_activities"("class_id", "section_id", "status");
CREATE INDEX IF NOT EXISTS "class_activities_type_idx" ON "class_activities"("type");
CREATE UNIQUE INDEX IF NOT EXISTS "class_submissions_activity_id_student_id_key" ON "class_submissions"("activity_id", "student_id");
CREATE INDEX IF NOT EXISTS "class_submissions_student_id_status_idx" ON "class_submissions"("student_id", "status");
CREATE INDEX IF NOT EXISTS "class_forum_posts_activity_id_created_at_idx" ON "class_forum_posts"("activity_id", "created_at");
CREATE INDEX IF NOT EXISTS "class_forum_posts_author_id_idx" ON "class_forum_posts"("author_id");
CREATE INDEX IF NOT EXISTS "class_attendance_records_student_id_status_idx" ON "class_attendance_records"("student_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "class_completions_student_id_resource_id_key" ON "class_completions"("student_id", "resource_id");
CREATE UNIQUE INDEX IF NOT EXISTS "class_completions_student_id_activity_id_key" ON "class_completions"("student_id", "activity_id");
CREATE INDEX IF NOT EXISTS "class_completions_class_id_student_id_idx" ON "class_completions"("class_id", "student_id");
CREATE INDEX IF NOT EXISTS "class_activity_logs_class_id_created_at_idx" ON "class_activity_logs"("class_id", "created_at");
CREATE INDEX IF NOT EXISTS "class_activity_logs_actor_id_idx" ON "class_activity_logs"("actor_id");
