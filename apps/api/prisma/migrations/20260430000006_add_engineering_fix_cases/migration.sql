-- CreateEnum
CREATE TYPE "EngineeringFixStatus" AS ENUM ('PENDING', 'INVESTIGATING', 'FIX_READY', 'PR_OPENED', 'MERGED', 'FAILED');

-- CreateTable
CREATE TABLE "engineering_fix_cases" (
    "id" TEXT NOT NULL,
    "diagnostic_case_id" TEXT,
    "branch_name" TEXT,
    "status" "EngineeringFixStatus" NOT NULL DEFAULT 'PENDING',
    "pr_url" TEXT,
    "pr_number" INTEGER,
    "files_changed_json" JSONB,
    "test_added_json" JSONB,
    "fix_summary" TEXT,
    "rollback_notes" TEXT,
    "error_log" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engineering_fix_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engineering_fix_cases_status_idx" ON "engineering_fix_cases"("status");

-- CreateIndex
CREATE INDEX "engineering_fix_cases_diagnostic_case_id_idx" ON "engineering_fix_cases"("diagnostic_case_id");

-- AddForeignKey
ALTER TABLE "engineering_fix_cases" ADD CONSTRAINT "engineering_fix_cases_diagnostic_case_id_fkey" FOREIGN KEY ("diagnostic_case_id") REFERENCES "support_diagnostic_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
