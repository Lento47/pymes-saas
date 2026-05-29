-- CreateTable
CREATE TABLE "router_metrics_snapshots" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "intent" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "model_tier" TEXT NOT NULL,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "router_metrics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "router_metrics_snapshots_workspace_id_date_intent_agent_type_model_tier_key"
    ON "router_metrics_snapshots"("workspace_id", "date", "intent", "agent_type", "model_tier");

-- CreateIndex
CREATE INDEX "router_metrics_snapshots_workspace_id_idx" ON "router_metrics_snapshots"("workspace_id");

-- CreateIndex
CREATE INDEX "router_metrics_snapshots_workspace_id_date_idx" ON "router_metrics_snapshots"("workspace_id", "date");
