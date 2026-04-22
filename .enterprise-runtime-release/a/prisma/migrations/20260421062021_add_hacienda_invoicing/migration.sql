-- CreateEnum
CREATE TYPE "InvoiceDocumentType" AS ENUM ('FACTURA_ELECTRONICA', 'TIQUETE_ELECTRONICO', 'NOTA_CREDITO', 'NOTA_DEBITO', 'MENSAJE_RECEPTOR');

-- CreateEnum
CREATE TYPE "InvoiceIssuanceMode" AS ENUM ('MANUAL_ONLY', 'HACIENDA');

-- CreateEnum
CREATE TYPE "HaciendaStatus" AS ENUM ('DRAFT', 'PENDING_SUBMISSION', 'SUBMITTED', 'RECIBIDO', 'PROCESANDO', 'ACEPTADO', 'RECHAZADO', 'ERROR');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "address_detail" TEXT,
ADD COLUMN     "canton" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "foreign_identification" TEXT,
ADD COLUMN     "identification_number" TEXT,
ADD COLUMN     "identification_type" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "receptor_validation_json" JSONB,
ADD COLUMN     "tax_email" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "activity_code" TEXT,
ADD COLUMN     "clave" TEXT,
ADD COLUMN     "consecutivo" TEXT,
ADD COLUMN     "document_type" "InvoiceDocumentType" NOT NULL DEFAULT 'FACTURA_ELECTRONICA',
ADD COLUMN     "exchange_rate" DECIMAL(12,5),
ADD COLUMN     "hacienda_last_checked_at" TIMESTAMP(3),
ADD COLUMN     "hacienda_last_error" TEXT,
ADD COLUMN     "hacienda_location_url" TEXT,
ADD COLUMN     "hacienda_status" "HaciendaStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "hacienda_submitted_at" TIMESTAMP(3),
ADD COLUMN     "issuance_mode" "InvoiceIssuanceMode" NOT NULL DEFAULT 'MANUAL_ONLY',
ADD COLUMN     "issue_date" TIMESTAMP(3),
ADD COLUMN     "payment_method" TEXT,
ADD COLUMN     "reference_invoice_id" TEXT,
ADD COLUMN     "response_xml_storage_key" TEXT,
ADD COLUMN     "sale_condition" TEXT,
ADD COLUMN     "signed_xml_storage_key" TEXT;

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,5) NOT NULL,
    "discount_amount" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,5) NOT NULL,
    "tax_amount" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "total_line_amount" DECIMAL(12,5) NOT NULL,
    "cabys_code" TEXT,
    "unit_of_measure" TEXT,
    "tax_code" TEXT,
    "tax_rate" DECIMAL(5,2),
    "exoneration_json" JSONB,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_tax_profiles" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "identification_type" TEXT NOT NULL,
    "identification_number" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "activity_code" TEXT NOT NULL,
    "province" TEXT,
    "canton" TEXT,
    "district" TEXT,
    "address_detail" TEXT,
    "tax_email" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_tax_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_lines_workspace_id_idx" ON "invoice_lines"("workspace_id");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoice_id_line_number_key" ON "invoice_lines"("invoice_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_tax_profiles_workspace_id_key" ON "workspace_tax_profiles"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_tax_profiles_workspace_id_idx" ON "workspace_tax_profiles"("workspace_id");

-- CreateIndex
CREATE INDEX "contacts_workspace_id_identification_number_idx" ON "contacts"("workspace_id", "identification_number");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_hacienda_status_idx" ON "invoices"("workspace_id", "hacienda_status");

-- CreateIndex
CREATE INDEX "invoices_reference_invoice_id_idx" ON "invoices"("reference_invoice_id");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_clave_idx" ON "invoices"("workspace_id", "clave");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reference_invoice_id_fkey" FOREIGN KEY ("reference_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_tax_profiles" ADD CONSTRAINT "workspace_tax_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
