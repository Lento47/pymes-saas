-- CreateTable
CREATE TABLE "support_orchestration_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "diagnostic_case_id" TEXT,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "case_type" TEXT,
    "severity" TEXT,
    "needs_human_review" BOOLEAN NOT NULL DEFAULT false,
    "stages_json" JSONB NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_orchestration_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_orchestration_runs_workspace_id_idx" ON "support_orchestration_runs"("workspace_id");

-- CreateIndex
CREATE INDEX "support_orchestration_runs_workspace_id_created_at_idx" ON "support_orchestration_runs"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "support_orchestration_runs_status_idx" ON "support_orchestration_runs"("status");

-- AddForeignKey
ALTER TABLE "support_orchestration_runs" ADD CONSTRAINT "support_orchestration_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
