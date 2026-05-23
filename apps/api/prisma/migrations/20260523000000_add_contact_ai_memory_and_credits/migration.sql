-- CreateEnum
CREATE TYPE "AiMemoryStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXTENDED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'REFUND', 'BONUS');

-- CreateTable
CREATE TABLE "contact_ai_memories" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "profile_json" JSONB NOT NULL,
    "status" "AiMemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "extended_until" TIMESTAMP(3),

    CONSTRAINT "contact_ai_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_credit_balances" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_credit_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "description" TEXT,
    "paypal_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_ai_memories_contact_id_key" ON "contact_ai_memories"("contact_id");

-- CreateIndex
CREATE INDEX "contact_ai_memories_workspace_id_idx" ON "contact_ai_memories"("workspace_id");

-- CreateIndex
CREATE INDEX "contact_ai_memories_workspace_id_status_idx" ON "contact_ai_memories"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "contact_ai_memories_expires_at_idx" ON "contact_ai_memories"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_credit_balances_workspace_id_key" ON "workspace_credit_balances"("workspace_id");

-- CreateIndex
CREATE INDEX "credit_transactions_workspace_id_idx" ON "credit_transactions"("workspace_id");

-- CreateIndex
CREATE INDEX "credit_transactions_workspace_id_created_at_idx" ON "credit_transactions"("workspace_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "contact_ai_memories" ADD CONSTRAINT "contact_ai_memories_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_ai_memories" ADD CONSTRAINT "contact_ai_memories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_credit_balances" ADD CONSTRAINT "workspace_credit_balances_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_workspace_id_balance_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace_credit_balances"("workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;
