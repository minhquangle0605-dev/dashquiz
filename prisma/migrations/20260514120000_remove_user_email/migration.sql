-- DropIndex
DROP INDEX IF EXISTS "users_email_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN IF EXISTS "email";
