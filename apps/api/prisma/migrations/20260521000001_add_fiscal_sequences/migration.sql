-- CreateTable
CREATE TABLE "fiscal_sequences" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "branch_code" TEXT NOT NULL DEFAULT '001',
    "terminal_code" TEXT NOT NULL DEFAULT '00001',
    "document_type" "InvoiceDocumentType" NOT NULL,
    "current_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fiscal_sequences_workspace_id_idx" ON "fiscal_sequences"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_sequences_workspace_id_branch_code_terminal_code_doc_key" ON "fiscal_sequences"("workspace_id", "branch_code", "terminal_code", "document_type");

-- AddForeignKey
ALTER TABLE "fiscal_sequences" ADD CONSTRAINT "fiscal_sequences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
