-- CreateEnum (safe — skip if already exists from partial prior run)
DO $$ BEGIN
  CREATE TYPE "AgentSessionStatus" AS ENUM ('ACTIVE', 'CLOSED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EngineeringFixStatus" AS ENUM ('PENDING', 'INVESTIGATING', 'FIX_READY', 'PR_OPENED', 'MERGED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AgentSession (safe — skip if already exists)
CREATE TABLE IF NOT EXISTS "agent_sessions" (
    "id" TEXT NOT NULL, "workspace_id" TEXT NOT NULL, "user_id" TEXT,
    "agent_type" TEXT NOT NULL, "status" "AgentSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata_json" JSONB, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_sessions_workspace_id_idx" ON "agent_sessions"("workspace_id");
CREATE INDEX IF NOT EXISTS "agent_sessions_user_id_idx" ON "agent_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "agent_sessions_status_idx" ON "agent_sessions"("status");
CREATE INDEX IF NOT EXISTS "agent_sessions_workspace_created_idx" ON "agent_sessions"("workspace_id", "created_at" DESC);
DO $$ BEGIN ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AgentMessage
CREATE TABLE IF NOT EXISTS "agent_messages" (
    "id" TEXT NOT NULL, "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL, "content" TEXT NOT NULL,
    "metadata_json" JSONB, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_messages_session_id_idx" ON "agent_messages"("session_id");
CREATE INDEX IF NOT EXISTS "agent_messages_session_created_idx" ON "agent_messages"("session_id", "created_at");
DO $$ BEGIN ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AgentToolCall
CREATE TABLE IF NOT EXISTS "agent_tool_calls" (
    "id" TEXT NOT NULL, "session_id" TEXT NOT NULL, "agent_type" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL, "input_json" JSONB NOT NULL, "output_json" JSONB,
    "risk_level" TEXT, "allowed" BOOLEAN NOT NULL DEFAULT true, "blocked_reason" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_tool_calls_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_tool_calls_session_id_idx" ON "agent_tool_calls"("session_id");
CREATE INDEX IF NOT EXISTS "agent_tool_calls_tool_name_idx" ON "agent_tool_calls"("tool_name");
CREATE INDEX IF NOT EXISTS "agent_tool_calls_risk_level_idx" ON "agent_tool_calls"("risk_level");
DO $$ BEGIN ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AgentEscalation
CREATE TABLE IF NOT EXISTS "agent_escalations" (
    "id" TEXT NOT NULL, "session_id" TEXT, "workspace_id" TEXT NOT NULL, "user_id" TEXT,
    "severity" "Priority" NOT NULL DEFAULT 'MEDIUM', "summary" TEXT NOT NULL,
    "evidence_json" JSONB, "status" "EscalationStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by" TEXT, "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_escalations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_escalations_workspace_id_idx" ON "agent_escalations"("workspace_id");
CREATE INDEX IF NOT EXISTS "agent_escalations_status_idx" ON "agent_escalations"("status");
CREATE INDEX IF NOT EXISTS "agent_escalations_severity_idx" ON "agent_escalations"("severity");
CREATE INDEX IF NOT EXISTS "agent_escalations_workspace_status_idx" ON "agent_escalations"("workspace_id", "status");
DO $$ BEGIN ALTER TABLE "agent_escalations" ADD CONSTRAINT "agent_escalations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SupportDiagnosticCase
CREATE TABLE IF NOT EXISTS "support_diagnostic_cases" (
    "id" TEXT NOT NULL, "workspace_id" TEXT NOT NULL, "user_id" TEXT,
    "module" TEXT NOT NULL, "error_code" TEXT, "trace_id" TEXT,
    "category" TEXT NOT NULL, "risk_level" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL, "user_description" TEXT, "safe_summary" TEXT,
    "steps_json" JSONB, "evidence_json" JSONB, "resolution_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "support_diagnostic_cases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "support_diagnostic_cases_workspace_id_idx" ON "support_diagnostic_cases"("workspace_id");
CREATE INDEX IF NOT EXISTS "support_diagnostic_cases_error_code_idx" ON "support_diagnostic_cases"("error_code");
CREATE INDEX IF NOT EXISTS "support_diagnostic_cases_category_idx" ON "support_diagnostic_cases"("category");
CREATE INDEX IF NOT EXISTS "support_diagnostic_cases_status_idx" ON "support_diagnostic_cases"("status");
CREATE INDEX IF NOT EXISTS "support_diagnostic_cases_workspace_created_idx" ON "support_diagnostic_cases"("workspace_id", "created_at" DESC);
DO $$ BEGIN ALTER TABLE "support_diagnostic_cases" ADD CONSTRAINT "support_diagnostic_cases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SupportKnownIssue
CREATE TABLE IF NOT EXISTS "support_known_issues" (
    "id" TEXT NOT NULL, "error_code" TEXT NOT NULL, "title" TEXT NOT NULL,
    "module" TEXT NOT NULL, "category" TEXT NOT NULL, "severity" TEXT NOT NULL,
    "description" TEXT, "workaround" TEXT, "fix_status" TEXT NOT NULL DEFAULT 'OPEN',
    "fix_pr_url" TEXT, "affected_versions" TEXT, "fixed_in_version" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "support_known_issues_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "support_known_issues_error_code_key" ON "support_known_issues"("error_code");
CREATE INDEX IF NOT EXISTS "support_known_issues_module_idx" ON "support_known_issues"("module");
CREATE INDEX IF NOT EXISTS "support_known_issues_severity_idx" ON "support_known_issues"("severity");
CREATE INDEX IF NOT EXISTS "support_known_issues_fix_status_idx" ON "support_known_issues"("fix_status");

-- EngineeringFixCase
CREATE TABLE IF NOT EXISTS "engineering_fix_cases" (
    "id" TEXT NOT NULL, "diagnostic_case_id" TEXT,
    "branch_name" TEXT, "status" "EngineeringFixStatus" NOT NULL DEFAULT 'PENDING',
    "pr_url" TEXT, "pr_number" INTEGER,
    "files_changed_json" JSONB, "test_added_json" JSONB,
    "module" TEXT NOT NULL, "severity" TEXT NOT NULL, "error_source" TEXT,
    "description" TEXT NOT NULL, "commit_sha" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0, "last_error" TEXT,
    "started_at" TIMESTAMP(3), "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "engineering_fix_cases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "engineering_fix_cases_status_idx" ON "engineering_fix_cases"("status");
CREATE INDEX IF NOT EXISTS "engineering_fix_cases_diagnostic_case_idx" ON "engineering_fix_cases"("diagnostic_case_id");
DO $$ BEGIN ALTER TABLE "engineering_fix_cases" ADD CONSTRAINT "engineering_fix_cases_diagnostic_case_id_fkey" FOREIGN KEY ("diagnostic_case_id") REFERENCES "support_diagnostic_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
