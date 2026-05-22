-- Add EMPRENDE to WorkspacePlan enum
-- PostgreSQL 12+ supports ALTER TYPE ADD VALUE inside transactions
ALTER TYPE "WorkspacePlan" ADD VALUE IF NOT EXISTS 'EMPRENDE';

-- Add profile column to workspaces
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "profile" TEXT NOT NULL DEFAULT 'business';
