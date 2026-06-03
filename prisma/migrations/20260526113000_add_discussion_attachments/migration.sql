-- CreateEnum
CREATE TYPE "DiscussionAttachmentType" AS ENUM ('LINK', 'FILE', 'IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "discussion_attachments" (
    "id" SERIAL NOT NULL,
    "discussion_id" INTEGER NOT NULL,
    "reply_id" INTEGER,
    "uploader_id" INTEGER NOT NULL,
    "type" "DiscussionAttachmentType" NOT NULL,
    "url" TEXT NOT NULL,
    "title" VARCHAR(255),
    "file_name" VARCHAR(255),
    "mime_type" VARCHAR(120),
    "file_size_bytes" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discussion_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discussion_attachments_discussion_id_created_at_idx" ON "discussion_attachments"("discussion_id", "created_at");

-- CreateIndex
CREATE INDEX "discussion_attachments_reply_id_idx" ON "discussion_attachments"("reply_id");

-- CreateIndex
CREATE INDEX "discussion_attachments_uploader_id_idx" ON "discussion_attachments"("uploader_id");

-- AddForeignKey
ALTER TABLE "discussion_attachments" ADD CONSTRAINT "discussion_attachments_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "discussions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_attachments" ADD CONSTRAINT "discussion_attachments_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "discussion_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_attachments" ADD CONSTRAINT "discussion_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
