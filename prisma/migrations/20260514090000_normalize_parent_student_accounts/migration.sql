-- Normalize account data so ADMIN/TEACHER/STUDENT/PARENT all authenticate via
-- users, while student/parent long-lived identifiers live in profile tables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT', 'PARENT');
  END IF;
END $$;

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PARENT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'STUDENT';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roles'
  ) THEN
    UPDATE "users" u
    SET "role" = UPPER(r."name")::"UserRole"
    FROM "roles" r
    WHERE u."role_id" = r."id"
      AND UPPER(r."name") IN ('ADMIN', 'TEACHER', 'STUDENT', 'PARENT');
  END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "username" SET DATA TYPE VARCHAR(191);

DO $$
DECLARE
  constraint_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role_id'
  ) THEN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'users'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'role_id'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE "users" DROP CONSTRAINT %I', constraint_name);
    END IF;

    ALTER TABLE "users" DROP COLUMN "role_id";
  END IF;
END $$;

DROP TABLE IF EXISTS "roles";

CREATE TABLE IF NOT EXISTS "parents" (
    "parent_id" VARCHAR(50) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "phone_number" VARCHAR(20),
    "full_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("parent_id")
);

CREATE TABLE IF NOT EXISTS "students" (
    "student_id" VARCHAR(50) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "parent_id" VARCHAR(50),
    "full_name" VARCHAR(100) NOT NULL,
    "class_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("student_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "parents_user_id_key" ON "parents"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "parents_phone_number_key" ON "parents"("phone_number");
CREATE UNIQUE INDEX IF NOT EXISTS "students_user_id_key" ON "students"("user_id");
CREATE INDEX IF NOT EXISTS "students_parent_id_idx" ON "students"("parent_id");
CREATE INDEX IF NOT EXISTS "students_class_id_idx" ON "students"("class_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parents_user_id_fkey') THEN
    ALTER TABLE "parents"
      ADD CONSTRAINT "parents_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_user_id_fkey') THEN
    ALTER TABLE "students"
      ADD CONSTRAINT "students_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_parent_id_fkey') THEN
    ALTER TABLE "students"
      ADD CONSTRAINT "students_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "parents"("parent_id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_class_id_fkey') THEN
    ALTER TABLE "students"
      ADD CONSTRAINT "students_class_id_fkey"
      FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "students" ("student_id", "user_id", "full_name", "created_at")
SELECT
  'legacy-student-' || u."id"::text,
  u."id",
  COALESCE(NULLIF(u."full_name", ''), u."username"),
  u."created_at"
FROM "users" u
WHERE u."role" = 'STUDENT'
ON CONFLICT ("user_id") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'parent_password_hash'
  ) THEN
    INSERT INTO "users" (
      "role",
      "username",
      "password_hash",
      "full_name",
      "phone",
      "avatar",
      "status",
      "created_at"
    )
    SELECT
      'PARENT'::"UserRole",
      'parent.' || u."username",
      u."parent_password_hash",
      COALESCE(NULLIF(u."full_name", ''), u."username") || ' Parent',
      NULL,
      NULL,
      u."status",
      u."created_at"
    FROM "users" u
    WHERE u."role" = 'STUDENT'
      AND u."parent_password_hash" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "users" pu WHERE pu."username" = 'parent.' || u."username"
      );

    INSERT INTO "parents" ("parent_id", "user_id", "full_name", "created_at")
    SELECT
      'legacy-parent-' || su."id"::text,
      pu."id",
      pu."full_name",
      pu."created_at"
    FROM "users" su
    JOIN "users" pu ON pu."username" = 'parent.' || su."username"
    WHERE su."role" = 'STUDENT'
      AND su."parent_password_hash" IS NOT NULL
    ON CONFLICT ("user_id") DO NOTHING;

    UPDATE "students" sp
    SET "parent_id" = pp."parent_id"
    FROM "users" su
    JOIN "users" pu ON pu."username" = 'parent.' || su."username"
    JOIN "parents" pp ON pp."user_id" = pu."id"
    WHERE sp."user_id" = su."id"
      AND su."role" = 'STUDENT'
      AND su."parent_password_hash" IS NOT NULL;

    ALTER TABLE "users" DROP COLUMN "parent_password_hash";
  END IF;
END $$;
