-- CreateTable
CREATE TABLE "ai_decision_audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "agent_used" TEXT NOT NULL,
    "llm_used" BOOLEAN NOT NULL DEFAULT false,
    "tools_used" TEXT[],
    "policy_decision" TEXT NOT NULL,
    "send_mode" TEXT NOT NULL,
    "human_approval_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_decision_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_decision_audit_logs_workspace_id_idx" ON "ai_decision_audit_logs"("workspace_id");

-- CreateIndex
CREATE INDEX "ai_decision_audit_logs_workspace_id_conversation_id_idx" ON "ai_decision_audit_logs"("workspace_id", "conversation_id");

-- CreateIndex
CREATE INDEX "ai_decision_audit_logs_workspace_id_created_at_idx" ON "ai_decision_audit_logs"("workspace_id", "created_at" DESC);
