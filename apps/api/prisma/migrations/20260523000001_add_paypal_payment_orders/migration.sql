-- CreateEnum
CREATE TYPE "PaypalPaymentStatus" AS ENUM ('CREATED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "paypal_payment_orders" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "capture_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "credits" INTEGER NOT NULL,
    "status" "PaypalPaymentStatus" NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paypal_payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paypal_payment_orders_order_id_key" ON "paypal_payment_orders"("order_id");

-- CreateIndex
CREATE INDEX "paypal_payment_orders_workspace_id_idx" ON "paypal_payment_orders"("workspace_id");

-- CreateIndex
CREATE INDEX "paypal_payment_orders_status_idx" ON "paypal_payment_orders"("status");

-- AddForeignKey
ALTER TABLE "paypal_payment_orders" ADD CONSTRAINT "paypal_payment_orders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
