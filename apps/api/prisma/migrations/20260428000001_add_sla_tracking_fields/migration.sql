-- Add SLA tracking columns to conversations table
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "first_response_at" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "sla_breached" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "sla_target_hours" INTEGER;
