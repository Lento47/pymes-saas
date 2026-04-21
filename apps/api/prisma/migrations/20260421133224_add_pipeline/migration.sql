-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "deal_stages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "assigned_user_id" TEXT,
    "title" TEXT NOT NULL,
    "value" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'CRC',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "closing_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_stages_workspace_id_idx" ON "deal_stages"("workspace_id");

-- CreateIndex
CREATE INDEX "deal_stages_workspace_id_order_idx" ON "deal_stages"("workspace_id", "order");

-- CreateIndex
CREATE INDEX "deals_workspace_id_idx" ON "deals"("workspace_id");

-- CreateIndex
CREATE INDEX "deals_workspace_id_stage_id_idx" ON "deals"("workspace_id", "stage_id");

-- CreateIndex
CREATE INDEX "deals_workspace_id_status_idx" ON "deals"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "deals_workspace_id_contact_id_idx" ON "deals"("workspace_id", "contact_id");

-- CreateIndex
CREATE INDEX "deals_workspace_id_assigned_user_id_idx" ON "deals"("workspace_id", "assigned_user_id");

-- AddForeignKey
ALTER TABLE "deal_stages" ADD CONSTRAINT "deal_stages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "deal_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
