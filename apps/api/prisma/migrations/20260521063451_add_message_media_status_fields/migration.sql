-- CreateMessageType
DO $$
BEGIN
  CREATE TYPE "MessageType" AS ENUM ('TEXT','IMAGE','VIDEO','AUDIO','DOCUMENT','STICKER','LOCATION','CONTACT','REACTION','REPLY','BUTTON','LIST','TEMPLATE','CATALOG','PRODUCT','FLOW','ORDER','INTERACTIVE','UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateMediaStatus
DO $$
BEGIN
  CREATE TYPE "MediaStatus" AS ENUM ('NONE','PROCESSING','AVAILABLE','ERROR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateMessageDeliveryStatus
DO $$
BEGIN
  CREATE TYPE "MessageDeliveryStatus" AS ENUM ('PENDING','SENT','DELIVERED','READ','FAILED','DISPATCH_FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: messages — media fields
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "message_type" "MessageType" DEFAULT 'TEXT';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "has_media" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "media_url" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "media_mime_type" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "media_filename" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "media_caption" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "media_thumbnail_url" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "media_size_bytes" INTEGER;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "media_status" "MediaStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachments_json" JSONB;

-- AlterTable: messages — delivery fields
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "delivery_status" "MessageDeliveryStatus";
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'delivery_status'
      AND udt_name <> 'MessageDeliveryStatus'
  ) THEN
    ALTER TABLE "messages"
      ALTER COLUMN "delivery_status" DROP DEFAULT,
      ALTER COLUMN "delivery_status" TYPE "MessageDeliveryStatus"
      USING (
        CASE UPPER(COALESCE("delivery_status"::text, 'PENDING'))
          WHEN 'PENDING' THEN 'PENDING'::"MessageDeliveryStatus"
          WHEN 'SENT' THEN 'SENT'::"MessageDeliveryStatus"
          WHEN 'DELIVERED' THEN 'DELIVERED'::"MessageDeliveryStatus"
          WHEN 'READ' THEN 'READ'::"MessageDeliveryStatus"
          WHEN 'FAILED' THEN 'FAILED'::"MessageDeliveryStatus"
          WHEN 'DISPATCH_FAILED' THEN 'DISPATCH_FAILED'::"MessageDeliveryStatus"
          ELSE 'PENDING'::"MessageDeliveryStatus"
        END
      );
  END IF;
END $$;
UPDATE "messages" SET "delivery_status" = 'PENDING' WHERE "delivery_status" IS NULL;
ALTER TABLE "messages" ALTER COLUMN "delivery_status" SET DEFAULT 'PENDING';
ALTER TABLE "messages" ALTER COLUMN "delivery_status" SET NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "delivery_error" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "external_message_id" TEXT;

-- AlterTable: messages — reply/interactive fields
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_message_id" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_sender_ref" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "button_payload_json" JSONB;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "interactive_type" TEXT;

-- AlterTable: conversations — WhatsApp fields
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "service_window_expires_at" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "unread_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "external_contact_id" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "external_conversation_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_workspace_id_external_conversation_key_key" ON "conversations"("workspace_id", "external_conversation_key");
CREATE INDEX IF NOT EXISTS "messages_external_message_id_idx" ON "messages"("external_message_id");
CREATE INDEX IF NOT EXISTS "messages_workspace_id_delivery_status_idx" ON "messages"("workspace_id", "delivery_status");
