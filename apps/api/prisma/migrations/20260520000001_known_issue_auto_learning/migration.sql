-- Add auto-learning fields to SupportKnownIssue so resolved diagnostic
-- cases can promote new entries / increment seen counters without
-- destroying manually-curated rows.

ALTER TABLE "support_known_issues"
  ADD COLUMN "auto_learned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "seen_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_seen_case_id" TEXT,
  ADD COLUMN "last_seen_at" TIMESTAMP(3);

CREATE INDEX "support_known_issues_auto_learned_idx"
  ON "support_known_issues"("auto_learned");
