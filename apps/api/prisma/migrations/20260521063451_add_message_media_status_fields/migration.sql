-- CreateMessageType
CREATE TYPE "MessageType" AS ENUM ('TEXT','IMAGE','VIDEO','AUDIO','DOCUMENT','STICKER','LOCATION','CONTACT','REACTION','REPLY','BUTTON','LIST','TEMPLATE','CATALOG','PRODUCT','FLOW','ORDER','INTERACTIVE','UNKNOWN');

-- CreateMediaStatus
CREATE TYPE "MediaStatus" AS ENUM ('NONE','PROCESSING','AVAILABLE','ERROR');

-- CreateMessageDeliveryStatus
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('PENDING','SENT','DELIVERED','READ','FAILED','DISPATCH_FAILED');

-- AlterTable: messages — media fields
ALTER TABLE "messages" ADD COLUMN "provider" TEXT;
ALTER TABLE "messages" ADD COLUMN "message_type" "MessageType" DEFAULT 'TEXT';
ALTER TABLE "messages" ADD COLUMN "has_media" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "messages" ADD COLUMN "media_url" TEXT;
ALTER TABLE "messages" ADD COLUMN "media_mime_type" TEXT;
ALTER TABLE "messages" ADD COLUMN "media_filename" TEXT;
ALTER TABLE "messages" ADD COLUMN "media_caption" TEXT;
ALTER TABLE "messages" ADD COLUMN "media_thumbnail_url" TEXT;
ALTER TABLE "messages" ADD COLUMN "media_size_bytes" INTEGER;
ALTER TABLE "messages" ADD COLUMN "media_status" "MediaStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "messages" ADD COLUMN "attachments_json" JSONB;

-- AlterTable: messages — delivery fields
ALTER TABLE "messages" ADD COLUMN "delivery_status" "MessageDeliveryStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "messages" ADD COLUMN "delivery_error" TEXT;
ALTER TABLE "messages" ADD COLUMN "external_message_id" TEXT;

-- AlterTable: messages — reply/interactive fields
ALTER TABLE "messages" ADD COLUMN "reply_to_message_id" TEXT;
ALTER TABLE "messages" ADD COLUMN "reply_to_sender_ref" TEXT;
ALTER TABLE "messages" ADD COLUMN "button_payload_json" JSONB;
ALTER TABLE "messages" ADD COLUMN "interactive_type" TEXT;

-- AlterTable: conversations — WhatsApp fields
ALTER TABLE "conversations" ADD COLUMN "service_window_expires_at" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN "unread_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "conversations" ADD COLUMN "external_contact_id" TEXT;
ALTER TABLE "conversations" ADD COLUMN "external_conversation_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "conversations_workspace_id_external_conversation_key_key" ON "conversations"("workspace_id", "external_conversation_key");
CREATE INDEX "messages_external_message_id_idx" ON "messages"("external_message_id");
CREATE INDEX "messages_workspace_id_delivery_status_idx" ON "messages"("workspace_id", "delivery_status");
