-- Learning engine tables: business_memories, conversation_insights,
-- ai_feedback_events, playbook_suggestions.
-- These models existed in schema.prisma but had no corresponding migration.

-- CreateTable
CREATE TABLE "business_memories" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "facts_json" JSONB,
    "policies_json" JSONB,
    "faq_json" JSONB,
    "tone_rules_json" JSONB,
    "successful_patterns_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_insights" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "intent" TEXT,
    "sentiment" TEXT,
    "summary" TEXT,
    "unresolved_items_json" JSONB,
    "suggested_actions_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedback_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "message_id" TEXT,
    "contact_id" TEXT,
    "event_type" TEXT NOT NULL,
    "original_json" JSONB,
    "corrected_json" JSONB,
    "outcome_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_suggestions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "trigger_json" JSONB NOT NULL,
    "actions_json" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbook_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_memories_workspace_id_key" ON "business_memories"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_insights_conversation_id_key" ON "conversation_insights"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_insights_workspace_id_idx" ON "conversation_insights"("workspace_id");

-- CreateIndex
CREATE INDEX "ai_feedback_events_workspace_id_event_type_idx" ON "ai_feedback_events"("workspace_id", "event_type");

-- CreateIndex
CREATE INDEX "ai_feedback_events_workspace_id_contact_id_idx" ON "ai_feedback_events"("workspace_id", "contact_id");

-- CreateIndex
CREATE INDEX "playbook_suggestions_workspace_id_status_idx" ON "playbook_suggestions"("workspace_id", "status");

-- AddForeignKey
ALTER TABLE "business_memories" ADD CONSTRAINT "business_memories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback_events" ADD CONSTRAINT "ai_feedback_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_suggestions" ADD CONSTRAINT "playbook_suggestions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
