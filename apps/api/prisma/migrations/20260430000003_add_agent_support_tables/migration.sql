-- CreateEnum
CREATE TYPE "AgentSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ESCALATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "status" "AgentSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tool_calls" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input_json" JSONB NOT NULL,
    "output_json" JSONB,
    "risk_level" TEXT,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "blocked_reason" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_escalations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "severity" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "summary" TEXT NOT NULL,
    "evidence_json" JSONB,
    "status" "EscalationStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by" TEXT,
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_sessions_workspace_id_idx" ON "agent_sessions"("workspace_id");

-- CreateIndex
CREATE INDEX "agent_sessions_user_id_idx" ON "agent_sessions"("user_id");

-- CreateIndex
CREATE INDEX "agent_sessions_status_idx" ON "agent_sessions"("status");

-- CreateIndex
CREATE INDEX "agent_sessions_workspace_id_created_at_idx" ON "agent_sessions"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_messages_session_id_idx" ON "agent_messages"("session_id");

-- CreateIndex
CREATE INDEX "agent_messages_session_id_created_at_idx" ON "agent_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_tool_calls_session_id_idx" ON "agent_tool_calls"("session_id");

-- CreateIndex
CREATE INDEX "agent_tool_calls_tool_name_idx" ON "agent_tool_calls"("tool_name");

-- CreateIndex
CREATE INDEX "agent_tool_calls_risk_level_idx" ON "agent_tool_calls"("risk_level");

-- CreateIndex
CREATE INDEX "agent_escalations_workspace_id_idx" ON "agent_escalations"("workspace_id");

-- CreateIndex
CREATE INDEX "agent_escalations_status_idx" ON "agent_escalations"("status");

-- CreateIndex
CREATE INDEX "agent_escalations_severity_idx" ON "agent_escalations"("severity");

-- CreateIndex
CREATE INDEX "agent_escalations_workspace_id_status_idx" ON "agent_escalations"("workspace_id", "status");

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_escalations" ADD CONSTRAINT "agent_escalations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
