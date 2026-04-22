CREATE TYPE "DocumentStorageMode" AS ENUM ('REMOTE', 'LOCAL');

ALTER TABLE "documents"
  ADD COLUMN "original_file_name" TEXT,
  ADD COLUMN "storage_mode" "DocumentStorageMode" NOT NULL DEFAULT 'REMOTE',
  ADD COLUMN "storage_relative_path" TEXT,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'document',
  ADD COLUMN "entity_type" TEXT,
  ADD COLUMN "entity_id" TEXT;

UPDATE "documents"
SET
  "original_file_name" = "file_name",
  "storage_relative_path" = "storage_key",
  "entity_type" = CASE
    WHEN "task_id" IS NOT NULL THEN 'task'
    WHEN "conversation_id" IS NOT NULL THEN 'conversation'
    WHEN "contact_id" IS NOT NULL THEN 'contact'
    ELSE 'workspace'
  END,
  "entity_id" = COALESCE("task_id", "conversation_id", "contact_id", "workspace_id");

CREATE INDEX "documents_workspace_id_storage_mode_idx"
  ON "documents"("workspace_id", "storage_mode");
