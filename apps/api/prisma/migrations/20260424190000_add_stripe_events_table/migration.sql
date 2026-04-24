-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "external_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_events_external_id_key" ON "stripe_events"("external_id");

-- CreateIndex
CREATE INDEX "stripe_events_workspace_id_idx" ON "stripe_events"("workspace_id");

-- CreateIndex
CREATE INDEX "stripe_events_external_id_idx" ON "stripe_events"("external_id");

-- CreateIndex
CREATE INDEX "stripe_events_type_idx" ON "stripe_events"("type");

-- CreateIndex
CREATE INDEX "stripe_events_processed_idx" ON "stripe_events"("processed");

-- CreateIndex
CREATE INDEX "stripe_events_created_at_idx" ON "stripe_events"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "stripe_events" ADD CONSTRAINT "stripe_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
