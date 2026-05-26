-- CreateEnum
CREATE TYPE "AgentProvider" AS ENUM ('FLOWISE', 'INTERNAL');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'DRAFT');

-- CreateEnum
CREATE TYPE "AgentChannelScope" AS ENUM ('ALL', 'WHATSAPP', 'TELEGRAM', 'EMAIL', 'WEB');

-- CreateTable
CREATE TABLE "agent_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider" "AgentProvider" NOT NULL DEFAULT 'FLOWISE',
    "channel_scope" "AgentChannelScope" NOT NULL DEFAULT 'ALL',
    "config_json" JSONB,
    "thumbnail_url" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "is_free_tier" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_instances" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider" "AgentProvider" NOT NULL DEFAULT 'FLOWISE',
    "chatflow_id" TEXT NOT NULL DEFAULT '',
    "status" "AgentStatus" NOT NULL DEFAULT 'DRAFT',
    "channel_scope" "AgentChannelScope" NOT NULL DEFAULT 'ALL',
    "system_instructions" TEXT,
    "config_json" JSONB,
    "template_id" TEXT,
    "voice_enabled" BOOLEAN NOT NULL DEFAULT false,
    "elevenlabs_voice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_conversation_sessions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "agent_instance_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "flowise_session_id" TEXT NOT NULL,
    "channel" "AgentChannelScope" NOT NULL DEFAULT 'WEB',
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_conversation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_usage_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "agent_instance_id" TEXT NOT NULL,
    "session_id" TEXT,
    "channel" "AgentChannelScope" NOT NULL DEFAULT 'WEB',
    "input_chars" INTEGER NOT NULL DEFAULT 0,
    "output_chars" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "cost_usd" DECIMAL(12,8),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_templates_slug_key" ON "agent_templates"("slug");

-- CreateIndex
CREATE INDEX "agent_templates_is_published_idx" ON "agent_templates"("is_published");

-- CreateIndex
CREATE INDEX "agent_instances_workspace_id_idx" ON "agent_instances"("workspace_id");

-- CreateIndex
CREATE INDEX "agent_instances_workspace_id_status_idx" ON "agent_instances"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "agent_instances_workspace_id_channel_scope_idx" ON "agent_instances"("workspace_id", "channel_scope");

-- CreateIndex
CREATE INDEX "agent_conversation_sessions_workspace_id_idx" ON "agent_conversation_sessions"("workspace_id");

-- CreateIndex
CREATE INDEX "agent_conversation_sessions_agent_instance_id_idx" ON "agent_conversation_sessions"("agent_instance_id");

-- CreateIndex
CREATE INDEX "agent_conversation_sessions_conversation_id_idx" ON "agent_conversation_sessions"("conversation_id");

-- CreateIndex
CREATE INDEX "agent_conversation_sessions_flowise_session_id_idx" ON "agent_conversation_sessions"("flowise_session_id");

-- CreateIndex
CREATE INDEX "agent_usage_events_workspace_id_idx" ON "agent_usage_events"("workspace_id");

-- CreateIndex
CREATE INDEX "agent_usage_events_workspace_id_created_at_idx" ON "agent_usage_events"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_usage_events_agent_instance_id_idx" ON "agent_usage_events"("agent_instance_id");

-- AddForeignKey
ALTER TABLE "agent_instances" ADD CONSTRAINT "agent_instances_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_instances" ADD CONSTRAINT "agent_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "agent_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_conversation_sessions" ADD CONSTRAINT "agent_conversation_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_conversation_sessions" ADD CONSTRAINT "agent_conversation_sessions_agent_instance_id_fkey" FOREIGN KEY ("agent_instance_id") REFERENCES "agent_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_usage_events" ADD CONSTRAINT "agent_usage_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_usage_events" ADD CONSTRAINT "agent_usage_events_agent_instance_id_fkey" FOREIGN KEY ("agent_instance_id") REFERENCES "agent_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
