-- CreateEnum
CREATE TYPE "FiscalEnvironment" AS ENUM ('STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "FiscalCertificateStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'INVALID');

-- CreateTable
CREATE TABLE "fiscal_certificates" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'HACIENDA_CR',
    "environment" "FiscalEnvironment" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "encrypted_pin" TEXT NOT NULL,
    "fingerprint_sha256" TEXT NOT NULL,
    "subject" TEXT,
    "issuer" TEXT,
    "serial_number" TEXT,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "status" "FiscalCertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fiscal_certificates_workspace_id_idx" ON "fiscal_certificates"("workspace_id");

-- CreateIndex
CREATE INDEX "fiscal_certificates_workspace_id_status_idx" ON "fiscal_certificates"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_certificates_workspace_id_fingerprint_sha256_key" ON "fiscal_certificates"("workspace_id", "fingerprint_sha256");

-- AddForeignKey
ALTER TABLE "fiscal_certificates" ADD CONSTRAINT "fiscal_certificates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
