-- Add compound indexes for performance:
-- 1. messages: latest message preview per conversation (inbox list)
-- 2. messages: conversation-scoped message queries (findAll)
-- 3. refresh_tokens: workspace-scoped token queries

CREATE INDEX IF NOT EXISTS "messages_conversation_id_sent_at_idx" ON "messages" ("conversation_id", "sent_at" DESC);
CREATE INDEX IF NOT EXISTS "messages_conversation_id_workspace_id_sent_at_idx" ON "messages" ("conversation_id", "workspace_id", "sent_at");
CREATE INDEX IF NOT EXISTS "refresh_tokens_workspace_id_idx" ON "refresh_tokens" ("workspace_id");
