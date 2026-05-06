-- CreateTable
CREATE TABLE "support_diagnostic_cases" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT,
    "module" TEXT NOT NULL,
    "error_code" TEXT,
    "trace_id" TEXT,
    "category" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "user_description" TEXT,
    "safe_summary" TEXT,
    "steps_json" JSONB,
    "evidence_json" JSONB,
    "resolution_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_diagnostic_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_known_issues" (
    "id" TEXT NOT NULL,
    "error_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT,
    "workaround" TEXT,
    "fix_status" TEXT NOT NULL DEFAULT 'OPEN',
    "fix_pr_url" TEXT,
    "affected_versions" TEXT,
    "fixed_in_version" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_known_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_known_issues_error_code_key" ON "support_known_issues"("error_code");

-- CreateIndex
CREATE INDEX "support_diagnostic_cases_workspace_id_idx" ON "support_diagnostic_cases"("workspace_id");

-- CreateIndex
CREATE INDEX "support_diagnostic_cases_error_code_idx" ON "support_diagnostic_cases"("error_code");

-- CreateIndex
CREATE INDEX "support_diagnostic_cases_category_idx" ON "support_diagnostic_cases"("category");

-- CreateIndex
CREATE INDEX "support_diagnostic_cases_status_idx" ON "support_diagnostic_cases"("status");

-- CreateIndex
CREATE INDEX "support_diagnostic_cases_workspace_id_created_at_idx" ON "support_diagnostic_cases"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "support_known_issues_error_code_idx" ON "support_known_issues"("error_code");

-- CreateIndex
CREATE INDEX "support_known_issues_module_idx" ON "support_known_issues"("module");

-- CreateIndex
CREATE INDEX "support_known_issues_severity_idx" ON "support_known_issues"("severity");

-- CreateIndex
CREATE INDEX "support_known_issues_fix_status_idx" ON "support_known_issues"("fix_status");

-- AddForeignKey
ALTER TABLE "support_diagnostic_cases" ADD CONSTRAINT "support_diagnostic_cases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
