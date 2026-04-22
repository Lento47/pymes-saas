CREATE TABLE "error_reports" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "user_id" TEXT,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'ERROR',
    "title" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "route" TEXT,
    "url" TEXT,
    "method" TEXT,
    "status_code" INTEGER,
    "user_agent" TEXT,
    "context_json" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "error_reports_workspace_id_idx" ON "error_reports"("workspace_id");
CREATE INDEX "error_reports_user_id_idx" ON "error_reports"("user_id");
CREATE INDEX "error_reports_source_idx" ON "error_reports"("source");
CREATE INDEX "error_reports_category_idx" ON "error_reports"("category");
CREATE INDEX "error_reports_severity_idx" ON "error_reports"("severity");
CREATE INDEX "error_reports_status_code_idx" ON "error_reports"("status_code");
CREATE INDEX "error_reports_occurred_at_idx" ON "error_reports"("occurred_at" DESC);

ALTER TABLE "error_reports"
ADD CONSTRAINT "error_reports_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "error_reports"
ADD CONSTRAINT "error_reports_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
