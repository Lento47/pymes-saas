-- Add Learning Engine fields to contact_ai_memories
-- These columns are referenced in the schema but missing from production DB
ALTER TABLE "contact_ai_memories" ADD COLUMN "objections_json" JSONB;
ALTER TABLE "contact_ai_memories" ADD COLUMN "interests_json" JSONB;
ALTER TABLE "contact_ai_memories" ADD COLUMN "lead_score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "contact_ai_memories" ADD COLUMN "risk_score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "contact_ai_memories" ADD COLUMN "next_best_action" TEXT;
ALTER TABLE "contact_ai_memories" ADD COLUMN "channel_preference" TEXT;
