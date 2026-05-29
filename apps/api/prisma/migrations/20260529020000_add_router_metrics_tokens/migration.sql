-- AlterTable: add token tracking columns to router_metrics_snapshots
ALTER TABLE "router_metrics_snapshots"
    ADD COLUMN "tokens_consumed" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "tokens_saved"    INTEGER NOT NULL DEFAULT 0;
