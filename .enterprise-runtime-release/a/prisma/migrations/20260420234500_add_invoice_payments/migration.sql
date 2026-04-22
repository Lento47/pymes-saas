ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

ALTER TABLE "invoices"
ADD COLUMN "conversation_id" TEXT;

CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "recorded_by_user_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoices_workspace_id_conversation_id_idx" ON "invoices"("workspace_id", "conversation_id");
CREATE INDEX "invoice_payments_workspace_id_idx" ON "invoice_payments"("workspace_id");
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments"("invoice_id");
CREATE INDEX "invoice_payments_recorded_by_user_id_idx" ON "invoice_payments"("recorded_by_user_id");
CREATE INDEX "invoice_payments_workspace_id_paid_at_idx" ON "invoice_payments"("workspace_id", "paid_at");

ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoice_payments"
ADD CONSTRAINT "invoice_payments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_payments"
ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_payments"
ADD CONSTRAINT "invoice_payments_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
