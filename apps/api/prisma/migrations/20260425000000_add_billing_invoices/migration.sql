-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID');

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "client_name" TEXT NOT NULL,
    "client_email" TEXT NOT NULL,
    "client_company" TEXT,
    "client_address" TEXT,
    "client_tax_id" TEXT,
    "plan_name" TEXT NOT NULL,
    "plan_interval" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "pdf_url" TEXT,
    "line_items" JSONB NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_number_key" ON "billing_invoices"("number");
CREATE INDEX "billing_invoices_workspace_id_idx" ON "billing_invoices"("workspace_id");
CREATE INDEX "billing_invoices_subscription_id_idx" ON "billing_invoices"("subscription_id");
CREATE INDEX "billing_invoices_status_idx" ON "billing_invoices"("status");
CREATE INDEX "billing_invoices_issued_at_idx" ON "billing_invoices"("issued_at" DESC);

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "workspace_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
