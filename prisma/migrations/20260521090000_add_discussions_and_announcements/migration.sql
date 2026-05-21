-- CreateEnum
CREATE TYPE "DiscussionScope" AS ENUM ('CLASS', 'GLOBAL');

-- CreateEnum
CREATE TYPE "DiscussionType" AS ENUM ('ANNOUNCEMENT', 'DISCUSSION');

-- CreateTable
CREATE TABLE "discussions" (
    "id" SERIAL NOT NULL,
    "scope" "DiscussionScope" NOT NULL DEFAULT 'CLASS',
    "type" "DiscussionType" NOT NULL DEFAULT 'DISCUSSION',
    "class_id" INTEGER,
    "author_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discussions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discussion_replies" (
    "id" SERIAL NOT NULL,
    "discussion_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discussion_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discussions_scope_class_id_created_at_idx" ON "discussions"("scope", "class_id", "created_at");

-- CreateIndex
CREATE INDEX "discussions_type_created_at_idx" ON "discussions"("type", "created_at");

-- CreateIndex
CREATE INDEX "discussions_author_id_idx" ON "discussions"("author_id");

-- CreateIndex
CREATE INDEX "discussion_replies_discussion_id_created_at_idx" ON "discussion_replies"("discussion_id", "created_at");

-- CreateIndex
CREATE INDEX "discussion_replies_author_id_idx" ON "discussion_replies"("author_id");

-- AddForeignKey
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "discussions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
