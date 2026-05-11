-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRYABLE', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "workspace_id" TEXT,
    "phone_number_id" TEXT,
    "waba_id" TEXT,
    "provider_message_id" TEXT,
    "event_fingerprint" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_event_fingerprint_key" ON "webhook_events"("event_fingerprint");

-- CreateIndex
CREATE INDEX "webhook_events_provider_status_idx" ON "webhook_events"("provider", "status");

-- CreateIndex
CREATE INDEX "webhook_events_status_next_retry_at_idx" ON "webhook_events"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "webhook_events_workspace_id_idx" ON "webhook_events"("workspace_id");

-- CreateIndex
CREATE INDEX "webhook_events_phone_number_id_idx" ON "webhook_events"("phone_number_id");

-- CreateIndex
CREATE INDEX "webhook_events_provider_message_id_idx" ON "webhook_events"("provider_message_id");

-- AlterTable
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "provider_message_id" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "delivery_status" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "delivery_error" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "messages_workspace_id_provider_provider_message_id_key" ON "messages"("workspace_id", "provider", "provider_message_id");
