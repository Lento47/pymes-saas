-- Phase 1-4: Add BUSINESS and BUSINESS_PLUS plan tiers, new enterprise models,
-- WhatsApp service window fields, and all supporting infrastructure.

-- ============================================================
-- 1. Add new WorkspacePlan enum values
-- ============================================================
ALTER TYPE "WorkspacePlan" ADD VALUE IF NOT EXISTS 'BUSINESS';
ALTER TYPE "WorkspacePlan" ADD VALUE IF NOT EXISTS 'BUSINESS_PLUS';

-- ============================================================
-- 2. Add WhatsApp service window fields to conversations
-- ============================================================
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "last_customer_message_at" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "service_window_expires_at" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "is_service_window_open" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "requires_template_for_outbound" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 3. Add WhatsApp/Telegram cost tracking to messages
-- ============================================================
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "message_type" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "cost_category" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "cost_estimate" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "cost_currency" TEXT DEFAULT 'CRC';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "telegram_chat_id" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "telegram_user_id" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "telegram_message_id" TEXT;

-- ============================================================
-- 4. Create CapabilityStatus enum
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "CapabilityStatus" AS ENUM (
    'IMPLEMENTED',
    'PARTIAL',
    'BEHIND_FEATURE_FLAG',
    'REQUIRES_CONFIGURATION',
    'ROADMAP',
    'DISABLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. business_plus_capabilities table
-- ============================================================
CREATE TABLE IF NOT EXISTS "business_plus_capabilities" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "CapabilityStatus" NOT NULL DEFAULT 'ROADMAP',
  "visible_on_pricing" BOOLEAN NOT NULL DEFAULT false,
  "visible_in_admin" BOOLEAN NOT NULL DEFAULT true,
  "requires_sales_approval" BOOLEAN NOT NULL DEFAULT false,
  "requires_setup" BOOLEAN NOT NULL DEFAULT false,
  "documentation_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_plus_capabilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "business_plus_capabilities_key_key" ON "business_plus_capabilities"("key");
CREATE INDEX IF NOT EXISTS "business_plus_capabilities_status_idx" ON "business_plus_capabilities"("status");

-- ============================================================
-- 6. workspace_enterprise_configs table
-- ============================================================
CREATE TABLE IF NOT EXISTS "workspace_enterprise_configs" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "plan_key" TEXT NOT NULL DEFAULT 'BUSINESS_PLUS',
  "contract_type" TEXT,
  "contract_start_date" TIMESTAMP(3),
  "contract_end_date" TIMESTAMP(3),
  "custom_monthly_price" DOUBLE PRECISION,
  "custom_annual_price" DOUBLE PRECISION,
  "currency" TEXT DEFAULT 'CRC',
  "custom_limits" JSONB,
  "enabled_capabilities" TEXT[],
  "sla_tier" TEXT,
  "onboarding_tier" TEXT,
  "support_tier" TEXT,
  "security_tier" TEXT,
  "contract_notes" TEXT,
  "internal_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workspace_enterprise_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_enterprise_configs_workspace_id_key" ON "workspace_enterprise_configs"("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_enterprise_configs_plan_key_idx" ON "workspace_enterprise_configs"("plan_key");

ALTER TABLE "workspace_enterprise_configs" ADD CONSTRAINT "workspace_enterprise_configs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 7. workspace_sso_configs table
-- ============================================================
CREATE TABLE IF NOT EXISTS "workspace_sso_configs" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "provider_type" TEXT NOT NULL DEFAULT 'saml',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "idp_entity_id" TEXT,
  "idp_sso_url" TEXT,
  "idp_certificate_encrypted" TEXT,
  "metadata_url" TEXT,
  "metadata_xml_encrypted" TEXT,
  "sp_entity_id" TEXT,
  "acs_url" TEXT,
  "name_id_format" TEXT,
  "email_attribute" TEXT,
  "first_name_attribute" TEXT,
  "last_name_attribute" TEXT,
  "role_attribute" TEXT,
  "allow_password_fallback_for_admins" BOOLEAN NOT NULL DEFAULT true,
  "require_sso_for_members" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workspace_sso_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_sso_configs_workspace_id_key" ON "workspace_sso_configs"("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_sso_configs_workspace_id_enabled_idx" ON "workspace_sso_configs"("workspace_id", "enabled");

ALTER TABLE "workspace_sso_configs" ADD CONSTRAINT "workspace_sso_configs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 8. Create RequiredPlan enum
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "RequiredPlan" AS ENUM (
    'FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE', 'BUSINESS_PLUS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 9. feature_flags table
-- ============================================================
CREATE TABLE IF NOT EXISTS "feature_flags" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "required_plan" "RequiredPlan" NOT NULL DEFAULT 'FREE',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "feature_flags_key_key" ON "feature_flags"("key");
CREATE INDEX IF NOT EXISTS "feature_flags_required_plan_idx" ON "feature_flags"("required_plan");

-- ============================================================
-- 10. sla_policies table
-- ============================================================
CREATE TABLE IF NOT EXISTS "sla_policies" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "support_window" TEXT,
  "first_response_target_minutes" INTEGER,
  "resolution_target_hours" INTEGER,
  "uptime_target_percent" DOUBLE PRECISION,
  "applies_to_plan" TEXT NOT NULL DEFAULT 'BUSINESS_PLUS',
  "requires_contract" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sla_policies_key_key" ON "sla_policies"("key");
CREATE INDEX IF NOT EXISTS "sla_policies_applies_to_plan_idx" ON "sla_policies"("applies_to_plan");

-- ============================================================
-- 11. workspace_sla_assignments table
-- ============================================================
CREATE TABLE IF NOT EXISTS "workspace_sla_assignments" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "sla_policy_id" TEXT NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to" TIMESTAMP(3),
  "contract_reference" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workspace_sla_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workspace_sla_assignments_workspace_id_idx" ON "workspace_sla_assignments"("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_sla_assignments_sla_policy_id_idx" ON "workspace_sla_assignments"("sla_policy_id");

ALTER TABLE "workspace_sla_assignments" ADD CONSTRAINT "workspace_sla_assignments_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_sla_assignments" ADD CONSTRAINT "workspace_sla_assignments_sla_policy_id_fkey"
  FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 12. Create OnboardingStatus enum
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "OnboardingStatus" AS ENUM (
    'NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 13. onboarding_projects table
-- ============================================================
CREATE TABLE IF NOT EXISTS "onboarding_projects" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "plan_key" TEXT NOT NULL DEFAULT 'BUSINESS_PLUS',
  "owner_user_id" TEXT,
  "status" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "target_go_live_date" TIMESTAMP(3),
  "checklist" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT,
  "success_criteria" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "onboarding_projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_projects_workspace_id_key" ON "onboarding_projects"("workspace_id");
CREATE INDEX IF NOT EXISTS "onboarding_projects_status_idx" ON "onboarding_projects"("status");

ALTER TABLE "onboarding_projects" ADD CONSTRAINT "onboarding_projects_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "onboarding_projects" ADD CONSTRAINT "onboarding_projects_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 14. Create TemplateStatus enum
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "TemplateStatus" AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DISABLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 15. message_templates table
-- ============================================================
CREATE TABLE IF NOT EXISTS "message_templates" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
  "name" TEXT NOT NULL,
  "external_template_id" TEXT,
  "category" TEXT,
  "language" TEXT,
  "body" TEXT NOT NULL,
  "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "variables" JSONB,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "message_templates_workspace_id_idx" ON "message_templates"("workspace_id");
CREATE INDEX IF NOT EXISTS "message_templates_workspace_id_channel_idx" ON "message_templates"("workspace_id", "channel");
CREATE INDEX IF NOT EXISTS "message_templates_workspace_id_status_idx" ON "message_templates"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "message_templates_workspace_id_name_idx" ON "message_templates"("workspace_id", "name");

ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 16. workspace_usage_snapshots table
-- ============================================================
CREATE TABLE IF NOT EXISTS "workspace_usage_snapshots" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "contacts_count" INTEGER NOT NULL DEFAULT 0,
  "invoices_count" INTEGER NOT NULL DEFAULT 0,
  "automations_count" INTEGER NOT NULL DEFAULT 0,
  "storage_used_mb" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "users_count" INTEGER NOT NULL DEFAULT 0,
  "locations_count" INTEGER NOT NULL DEFAULT 0,
  "whatsapp_messages_count" INTEGER NOT NULL DEFAULT 0,
  "telegram_messages_count" INTEGER NOT NULL DEFAULT 0,
  "email_messages_count" INTEGER NOT NULL DEFAULT 0,
  "forms_submitted_count" INTEGER NOT NULL DEFAULT 0,
  "api_calls_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workspace_usage_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workspace_usage_snapshots_workspace_id_idx" ON "workspace_usage_snapshots"("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_usage_snapshots_workspace_id_period_idx" ON "workspace_usage_snapshots"("workspace_id", "period_start", "period_end");

ALTER TABLE "workspace_usage_snapshots" ADD CONSTRAINT "workspace_usage_snapshots_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 17. contact_sales_inquiries table
-- ============================================================
CREATE TABLE IF NOT EXISTS "contact_sales_inquiries" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT,
  "business_name" TEXT NOT NULL,
  "contact_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "industry" TEXT,
  "employee_count" INTEGER,
  "users_needed" INTEGER,
  "locations_count" INTEGER,
  "monthly_invoices_estimate" INTEGER,
  "contacts_estimate" INTEGER,
  "current_tools" TEXT,
  "channels_needed" TEXT[],
  "migration_needed" BOOLEAN NOT NULL DEFAULT false,
  "sso_needed" BOOLEAN NOT NULL DEFAULT false,
  "sla_needed" BOOLEAN NOT NULL DEFAULT false,
  "dedicated_onboarding_needed" BOOLEAN NOT NULL DEFAULT false,
  "custom_workflows_needed" BOOLEAN NOT NULL DEFAULT false,
  "preferred_onboarding_date" TIMESTAMP(3),
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contact_sales_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contact_sales_inquiries_workspace_id_idx" ON "contact_sales_inquiries"("workspace_id");
CREATE INDEX IF NOT EXISTS "contact_sales_inquiries_status_idx" ON "contact_sales_inquiries"("status");
CREATE INDEX IF NOT EXISTS "contact_sales_inquiries_email_idx" ON "contact_sales_inquiries"("email");

ALTER TABLE "contact_sales_inquiries" ADD CONSTRAINT "contact_sales_inquiries_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 18. Seed default SLA policies and Business+ capabilities
-- ============================================================

-- SLA policies
INSERT INTO "sla_policies" ("id", "key", "name", "support_window", "first_response_target_minutes", "resolution_target_hours", "uptime_target_percent", "applies_to_plan", "requires_contract", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'standard', 'Standard SLA', 'Mon-Fri 8am-6pm CST', 240, 24, 99.0, 'BUSINESS_PLUS', false, 'Standard business-hours support with 4h first response target and 24h resolution target.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'priority', 'Priority SLA', 'Mon-Sat 7am-10pm CST', 60, 8, 99.5, 'BUSINESS_PLUS', false, 'Priority support with 1h first response target, 8h resolution, and extended hours.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'custom', 'Custom SLA', NULL, NULL, NULL, NULL, 'BUSINESS_PLUS', true, 'Fully customized SLA defined by contract terms.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Business+ capabilities
INSERT INTO "business_plus_capabilities" ("id", "key", "name", "description", "status", "visible_on_pricing", "visible_in_admin", "requires_sales_approval", "requires_setup", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'custom_limits', 'Custom Limits', 'Configurable plan limits per workspace', 'BEHIND_FEATURE_FLAG', true, true, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sso_saml', 'SSO / SAML', 'Single Sign-On via SAML 2.0', 'PARTIAL', true, true, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sla_options', 'SLA Options', 'Service Level Agreements with defined response/resolution targets', 'PARTIAL', true, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'dedicated_onboarding', 'Dedicated Onboarding', 'Personalized onboarding with project tracking', 'ROADMAP', true, true, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'custom_workflows', 'Custom Workflows', 'Tailored workflow automations', 'PARTIAL', true, true, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'advanced_security', 'Advanced Security', 'Enhanced security controls and compliance features', 'PARTIAL', true, true, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'dedicated_support', 'Dedicated Support', 'Priority support channel with named contacts', 'DISABLED', true, true, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'custom_contract', 'Custom Contract', 'Negotiated contract terms and billing arrangements', 'DISABLED', true, true, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'custom_data_migration', 'Custom Data Migration', 'Structured data import and migration assistance', 'REQUIRES_CONFIGURATION', false, true, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'advanced_reporting', 'Advanced Reporting', 'Custom reports and analytics dashboards', 'PARTIAL', false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin_configuration', 'Admin-Level Configuration', 'Enterprise admin controls and workspace management', 'PARTIAL', false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'omnichannel_routing', 'Omnichannel Routing', 'Cross-channel conversation routing rules', 'PARTIAL', false, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
