-- AlterEnum
ALTER TYPE "WorkspacePlan" ADD VALUE 'BETA_INFORMAL';

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "beta_profile" TEXT;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "features_json" JSONB;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "limits_json" JSONB;
