-- Normalize legacy text message_type values before Prisma reads the column as
-- the MessageType enum. Older migrations created messages.message_type as TEXT,
-- so rows can contain lowercase values such as "image".

DO $$
BEGIN
  CREATE TYPE "MessageType" AS ENUM ('TEXT','IMAGE','VIDEO','AUDIO','DOCUMENT','STICKER','LOCATION','CONTACT','REACTION','REPLY','BUTTON','LIST','TEMPLATE','CATALOG','PRODUCT','FLOW','ORDER','INTERACTIVE','UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "message_type" "MessageType";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'message_type'
      AND udt_name <> 'MessageType'
  ) THEN
    ALTER TABLE "messages"
      ALTER COLUMN "message_type" DROP DEFAULT,
      ALTER COLUMN "message_type" TYPE "MessageType"
      USING (
        CASE UPPER(COALESCE(NULLIF("message_type"::text, ''), 'TEXT'))
          WHEN 'TEXT' THEN 'TEXT'::"MessageType"
          WHEN 'IMAGE' THEN 'IMAGE'::"MessageType"
          WHEN 'PHOTO' THEN 'IMAGE'::"MessageType"
          WHEN 'VIDEO' THEN 'VIDEO'::"MessageType"
          WHEN 'AUDIO' THEN 'AUDIO'::"MessageType"
          WHEN 'VOICE' THEN 'AUDIO'::"MessageType"
          WHEN 'DOCUMENT' THEN 'DOCUMENT'::"MessageType"
          WHEN 'FILE' THEN 'DOCUMENT'::"MessageType"
          WHEN 'STICKER' THEN 'STICKER'::"MessageType"
          WHEN 'LOCATION' THEN 'LOCATION'::"MessageType"
          WHEN 'CONTACT' THEN 'CONTACT'::"MessageType"
          WHEN 'REACTION' THEN 'REACTION'::"MessageType"
          WHEN 'REPLY' THEN 'REPLY'::"MessageType"
          WHEN 'BUTTON' THEN 'BUTTON'::"MessageType"
          WHEN 'LIST' THEN 'LIST'::"MessageType"
          WHEN 'TEMPLATE' THEN 'TEMPLATE'::"MessageType"
          WHEN 'CATALOG' THEN 'CATALOG'::"MessageType"
          WHEN 'PRODUCT' THEN 'PRODUCT'::"MessageType"
          WHEN 'FLOW' THEN 'FLOW'::"MessageType"
          WHEN 'ORDER' THEN 'ORDER'::"MessageType"
          WHEN 'INTERACTIVE' THEN 'INTERACTIVE'::"MessageType"
          ELSE 'UNKNOWN'::"MessageType"
        END
      );
  END IF;
END $$;

UPDATE "messages" SET "message_type" = 'TEXT' WHERE "message_type" IS NULL;
ALTER TABLE "messages" ALTER COLUMN "message_type" SET DEFAULT 'TEXT';
