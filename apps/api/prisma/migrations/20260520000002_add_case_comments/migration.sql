-- CreateTable
CREATE TABLE IF NOT EXISTS "support_case_comments" (
    "id"           TEXT NOT NULL,
    "case_id"      TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id"      TEXT,
    "body"         TEXT NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_case_comments_case_id_created_at_idx"
    ON "support_case_comments"("case_id", "created_at");

-- AddForeignKey
ALTER TABLE "support_case_comments"
    ADD CONSTRAINT "support_case_comments_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "support_diagnostic_cases"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_case_comments"
    ADD CONSTRAINT "support_case_comments_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_case_comments"
    ADD CONSTRAINT "support_case_comments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
