-- Link error_reports to support_diagnostic_cases so an error and the
-- ticket it auto-opens are first-class connected. Used by the exception
-- filter and ErrorReportsService to bridge frontend/backend errors into
-- the support case system.

ALTER TABLE "error_reports"
  ADD COLUMN "diagnostic_case_id" TEXT;

ALTER TABLE "error_reports"
  ADD CONSTRAINT "error_reports_diagnostic_case_id_fkey"
  FOREIGN KEY ("diagnostic_case_id")
  REFERENCES "support_diagnostic_cases"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "error_reports_diagnostic_case_id_idx"
  ON "error_reports" ("diagnostic_case_id");
