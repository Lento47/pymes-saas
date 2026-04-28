-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "first_response_at" TIMESTAMP(3),
ADD COLUMN "resolved_at" TIMESTAMP(3),
ADD COLUMN "sla_breached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sla_target_hours" INTEGER;
