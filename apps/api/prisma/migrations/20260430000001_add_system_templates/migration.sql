-- System Templates + Workspace Templates
CREATE TABLE IF NOT EXISTS "system_templates" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "channel" TEXT,
  "body" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "system_templates_key_key" ON "system_templates"("key");
CREATE INDEX IF NOT EXISTS "system_templates_type_idx" ON "system_templates"("type");
CREATE INDEX IF NOT EXISTS "system_templates_type_is_active_idx" ON "system_templates"("type", "is_active");
CREATE INDEX IF NOT EXISTS "system_templates_category_idx" ON "system_templates"("category");

CREATE TABLE IF NOT EXISTS "workspace_templates" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "industry" TEXT,
  "pipeline_stages" JSONB NOT NULL,
  "contact_tags" TEXT[],
  "automation_rules" JSONB NOT NULL,
  "invoice_config" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workspace_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_templates_key_key" ON "workspace_templates"("key");
CREATE INDEX IF NOT EXISTS "workspace_templates_industry_idx" ON "workspace_templates"("industry");
CREATE INDEX IF NOT EXISTS "workspace_templates_is_active_idx" ON "workspace_templates"("is_active");
