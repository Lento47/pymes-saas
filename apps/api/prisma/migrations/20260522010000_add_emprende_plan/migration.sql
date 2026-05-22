-- AlterEnum: add EMPRENDE to WorkspacePlan
ALTER TYPE "WorkspacePlan" ADD VALUE 'EMPRENDE';

-- Add profile column to workspaces (defaults to 'business')
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "profile" TEXT NOT NULL DEFAULT 'business';
