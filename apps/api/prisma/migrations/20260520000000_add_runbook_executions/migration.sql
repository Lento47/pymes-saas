-- CreateTable
CREATE TABLE "runbook_executions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "diagnostic_case_id" TEXT,
    "runbook_name" TEXT NOT NULL,
    "parameters_json" JSONB NOT NULL,
    "executed_by_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result_json" JSONB,
    "error_log" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "runbook_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runbook_executions_workspace_id_idx" ON "runbook_executions"("workspace_id");

-- CreateIndex
CREATE INDEX "runbook_executions_runbook_name_idx" ON "runbook_executions"("runbook_name");

-- CreateIndex
CREATE INDEX "runbook_executions_status_idx" ON "runbook_executions"("status");

-- CreateIndex
CREATE INDEX "runbook_executions_workspace_id_created_at_idx" ON "runbook_executions"("workspace_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "runbook_executions" ADD CONSTRAINT "runbook_executions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runbook_executions" ADD CONSTRAINT "runbook_executions_diagnostic_case_id_fkey" FOREIGN KEY ("diagnostic_case_id") REFERENCES "support_diagnostic_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runbook_executions" ADD CONSTRAINT "runbook_executions_executed_by_user_id_fkey" FOREIGN KEY ("executed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
