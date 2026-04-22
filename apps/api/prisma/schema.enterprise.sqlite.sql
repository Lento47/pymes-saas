-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country_code" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "settings_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "password_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workspace_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'AGENT',
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "permissions_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workspace_users_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "refresh_tokens_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "department_ids" TEXT NOT NULL DEFAULT '[]',
    "invited_by_id" TEXT,
    "expires_at" DATETIME NOT NULL,
    "accepted_at" DATETIME,
    "revoked_at" DATETIME,
    "last_sent_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "send_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workspace_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'MANUAL',
    "plan" TEXT NOT NULL,
    "billing_interval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "external_reference" TEXT,
    "current_period_start" DATETIME,
    "current_period_end" DATETIME,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "trial_ends_at" DATETIME,
    "notes" TEXT,
    "metadata_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workspace_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "event_type" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "actor_user_id" TEXT,
    "applied_plan" TEXT,
    "payload_json" TEXT,
    "processed_at" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "billing_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "workspace_subscriptions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "billing_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "full_name" TEXT NOT NULL,
    "company_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "identification_type" TEXT,
    "identification_number" TEXT,
    "tax_email" TEXT,
    "province" TEXT,
    "canton" TEXT,
    "district" TEXT,
    "address_detail" TEXT,
    "foreign_identification" TEXT,
    "receptor_validation_json" TEXT,
    "external_ref" TEXT,
    "tags_json" TEXT,
    "last_interaction_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "contacts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_SETUP',
    "config_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "department_id" TEXT,
    CONSTRAINT "channels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "channels_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "assigned_user_id" TEXT,
    "last_message_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "department_id" TEXT,
    CONSTRAINT "conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conversations_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conversations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sender_name" TEXT,
    "sender_ref" TEXT,
    "sender_user_id" TEXT,
    "body_text" TEXT,
    "body_html" TEXT,
    "raw_payload_json" TEXT,
    "ai_classification_json" TEXT,
    "sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "contact_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assigned_user_id" TEXT,
    "due_at" DATETIME,
    "completed_at" DATETIME,
    "metadata_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "conversation_id" TEXT,
    "task_id" TEXT,
    "file_name" TEXT NOT NULL,
    "original_file_name" TEXT,
    "mime_type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "storage_mode" TEXT NOT NULL DEFAULT 'REMOTE',
    "storage_relative_path" TEXT,
    "checksum" TEXT,
    "category" TEXT NOT NULL DEFAULT 'document',
    "entity_type" TEXT,
    "entity_id" TEXT,
    "file_size" INTEGER NOT NULL,
    "ocr_text" TEXT,
    "extracted_data_json" TEXT,
    "summary_text" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "uploaded_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "reference_invoice_id" TEXT,
    "number" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "due_date" DATETIME NOT NULL,
    "paid_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "document_type" TEXT NOT NULL DEFAULT 'FACTURA_ELECTRONICA',
    "issuance_mode" TEXT NOT NULL DEFAULT 'MANUAL_ONLY',
    "hacienda_status" TEXT NOT NULL DEFAULT 'DRAFT',
    "clave" TEXT,
    "consecutivo" TEXT,
    "activity_code" TEXT,
    "sale_condition" TEXT,
    "payment_method" TEXT,
    "issue_date" DATETIME,
    "exchange_rate" DECIMAL,
    "hacienda_location_url" TEXT,
    "signed_xml_storage_key" TEXT,
    "response_xml_storage_key" TEXT,
    "hacienda_last_error" TEXT,
    "hacienda_last_checked_at" DATETIME,
    "hacienda_submitted_at" DATETIME,
    "description" TEXT,
    "notes_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "invoices_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoices_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invoices_reference_invoice_id_fkey" FOREIGN KEY ("reference_invoice_id") REFERENCES "invoices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unit_price" DECIMAL NOT NULL,
    "discount_amount" DECIMAL NOT NULL DEFAULT 0,
    "subtotal" DECIMAL NOT NULL,
    "tax_amount" DECIMAL NOT NULL DEFAULT 0,
    "total_line_amount" DECIMAL NOT NULL,
    "cabys_code" TEXT,
    "unit_of_measure" TEXT,
    "tax_code" TEXT,
    "tax_rate" DECIMAL,
    "exoneration_json" TEXT,
    "metadata_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "invoice_lines_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "recorded_by_user_id" TEXT,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "paid_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "invoice_payments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_payments_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_reminders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "draft_text" TEXT NOT NULL,
    "sent_at" DATETIME,
    "sent_via" TEXT,
    "approved_by" TEXT,
    "tokens_used" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_reminders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_reminders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workspace_tax_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workspace_tax_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "departments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "department_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "department_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "is_lead" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "department_members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "department_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_type" TEXT NOT NULL,
    "trigger_config_json" TEXT NOT NULL,
    "condition_config_json" TEXT,
    "action_config_json" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "automation_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "automation_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "trigger_entity_type" TEXT NOT NULL,
    "trigger_entity_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "input_json" TEXT,
    "output_json" TEXT,
    "error_message" TEXT,
    "started_at" DATETIME,
    "finished_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "automation_executions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "automation_executions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "summary_date" DATETIME NOT NULL,
    "generated_text" TEXT NOT NULL,
    "metrics_json" TEXT,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_summaries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" DATETIME,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" TEXT,
    "after_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deal_stages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "deal_stages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "assigned_user_id" TEXT,
    "title" TEXT NOT NULL,
    "value" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'CRC',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closing_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "deals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deals_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "deal_stages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "deals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "deals_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "error_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT,
    "user_id" TEXT,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'ERROR',
    "title" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "route" TEXT,
    "url" TEXT,
    "method" TEXT,
    "status_code" INTEGER,
    "user_agent" TEXT,
    "context_json" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "error_reports_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "error_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_slug_idx" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_status_idx" ON "workspaces"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "workspace_users_workspace_id_idx" ON "workspace_users"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_users_user_id_idx" ON "workspace_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_users_workspace_id_user_id_key" ON "workspace_users"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_workspace_id_idx" ON "refresh_tokens"("user_id", "workspace_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_token_hash_idx" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_workspace_id_email_idx" ON "invitations"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "invitations_expires_at_idx" ON "invitations"("expires_at");

-- CreateIndex
CREATE INDEX "workspace_subscriptions_workspace_id_idx" ON "workspace_subscriptions"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_subscriptions_workspace_id_status_idx" ON "workspace_subscriptions"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "workspace_subscriptions_workspace_id_plan_idx" ON "workspace_subscriptions"("workspace_id", "plan");

-- CreateIndex
CREATE INDEX "workspace_subscriptions_provider_provider_customer_id_idx" ON "workspace_subscriptions"("provider", "provider_customer_id");

-- CreateIndex
CREATE INDEX "workspace_subscriptions_provider_provider_subscription_id_idx" ON "workspace_subscriptions"("provider", "provider_subscription_id");

-- CreateIndex
CREATE INDEX "billing_events_workspace_id_idx" ON "billing_events"("workspace_id");

-- CreateIndex
CREATE INDEX "billing_events_subscription_id_idx" ON "billing_events"("subscription_id");

-- CreateIndex
CREATE INDEX "billing_events_provider_event_type_idx" ON "billing_events"("provider", "event_type");

-- CreateIndex
CREATE INDEX "billing_events_processed_at_idx" ON "billing_events"("processed_at");

-- CreateIndex
CREATE INDEX "billing_events_actor_user_id_idx" ON "billing_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "contacts_workspace_id_idx" ON "contacts"("workspace_id");

-- CreateIndex
CREATE INDEX "contacts_workspace_id_email_idx" ON "contacts"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "contacts_workspace_id_phone_idx" ON "contacts"("workspace_id", "phone");

-- CreateIndex
CREATE INDEX "contacts_workspace_id_identification_number_idx" ON "contacts"("workspace_id", "identification_number");

-- CreateIndex
CREATE INDEX "contacts_workspace_id_external_ref_idx" ON "contacts"("workspace_id", "external_ref");

-- CreateIndex
CREATE INDEX "contacts_workspace_id_type_idx" ON "contacts"("workspace_id", "type");

-- CreateIndex
CREATE INDEX "channels_workspace_id_idx" ON "channels"("workspace_id");

-- CreateIndex
CREATE INDEX "channels_workspace_id_type_idx" ON "channels"("workspace_id", "type");

-- CreateIndex
CREATE INDEX "channels_workspace_id_status_idx" ON "channels"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_idx" ON "conversations"("workspace_id");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_status_idx" ON "conversations"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_priority_idx" ON "conversations"("workspace_id", "priority");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_assigned_user_id_idx" ON "conversations"("workspace_id", "assigned_user_id");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_contact_id_idx" ON "conversations"("workspace_id", "contact_id");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_channel_id_idx" ON "conversations"("workspace_id", "channel_id");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_last_message_at_idx" ON "conversations"("workspace_id", "last_message_at");

-- CreateIndex
CREATE INDEX "messages_workspace_id_idx" ON "messages"("workspace_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_workspace_id_direction_idx" ON "messages"("workspace_id", "direction");

-- CreateIndex
CREATE INDEX "messages_sent_at_idx" ON "messages"("sent_at");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_idx" ON "tasks"("workspace_id");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_status_idx" ON "tasks"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_priority_idx" ON "tasks"("workspace_id", "priority");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_assigned_user_id_idx" ON "tasks"("workspace_id", "assigned_user_id");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_due_at_idx" ON "tasks"("workspace_id", "due_at");

-- CreateIndex
CREATE INDEX "tasks_workspace_id_source_idx" ON "tasks"("workspace_id", "source");

-- CreateIndex
CREATE INDEX "documents_workspace_id_idx" ON "documents"("workspace_id");

-- CreateIndex
CREATE INDEX "documents_workspace_id_status_idx" ON "documents"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "documents_workspace_id_storage_mode_idx" ON "documents"("workspace_id", "storage_mode");

-- CreateIndex
CREATE INDEX "documents_workspace_id_contact_id_idx" ON "documents"("workspace_id", "contact_id");

-- CreateIndex
CREATE INDEX "documents_workspace_id_conversation_id_idx" ON "documents"("workspace_id", "conversation_id");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_idx" ON "invoices"("workspace_id");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_status_idx" ON "invoices"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_hacienda_status_idx" ON "invoices"("workspace_id", "hacienda_status");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_contact_id_idx" ON "invoices"("workspace_id", "contact_id");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_conversation_id_idx" ON "invoices"("workspace_id", "conversation_id");

-- CreateIndex
CREATE INDEX "invoices_reference_invoice_id_idx" ON "invoices"("reference_invoice_id");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_clave_idx" ON "invoices"("workspace_id", "clave");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_due_date_idx" ON "invoices"("workspace_id", "due_date");

-- CreateIndex
CREATE INDEX "invoice_lines_workspace_id_idx" ON "invoice_lines"("workspace_id");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoice_id_line_number_key" ON "invoice_lines"("invoice_id", "line_number");

-- CreateIndex
CREATE INDEX "invoice_payments_workspace_id_idx" ON "invoice_payments"("workspace_id");

-- CreateIndex
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_payments_recorded_by_user_id_idx" ON "invoice_payments"("recorded_by_user_id");

-- CreateIndex
CREATE INDEX "invoice_payments_workspace_id_paid_at_idx" ON "invoice_payments"("workspace_id", "paid_at");

-- CreateIndex
CREATE INDEX "payment_reminders_workspace_id_idx" ON "payment_reminders"("workspace_id");

-- CreateIndex
CREATE INDEX "payment_reminders_invoice_id_idx" ON "payment_reminders"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_tax_profiles_workspace_id_key" ON "workspace_tax_profiles"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_tax_profiles_workspace_id_idx" ON "workspace_tax_profiles"("workspace_id");

-- CreateIndex
CREATE INDEX "departments_workspace_id_idx" ON "departments"("workspace_id");

-- CreateIndex
CREATE INDEX "departments_workspace_id_is_active_idx" ON "departments"("workspace_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "departments_workspace_id_name_key" ON "departments"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "department_members_workspace_id_idx" ON "department_members"("workspace_id");

-- CreateIndex
CREATE INDEX "department_members_user_id_idx" ON "department_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_members_department_id_user_id_key" ON "department_members"("department_id", "user_id");

-- CreateIndex
CREATE INDEX "automation_rules_workspace_id_idx" ON "automation_rules"("workspace_id");

-- CreateIndex
CREATE INDEX "automation_rules_workspace_id_enabled_idx" ON "automation_rules"("workspace_id", "enabled");

-- CreateIndex
CREATE INDEX "automation_rules_workspace_id_trigger_type_idx" ON "automation_rules"("workspace_id", "trigger_type");

-- CreateIndex
CREATE INDEX "automation_executions_workspace_id_idx" ON "automation_executions"("workspace_id");

-- CreateIndex
CREATE INDEX "automation_executions_rule_id_idx" ON "automation_executions"("rule_id");

-- CreateIndex
CREATE INDEX "automation_executions_workspace_id_status_idx" ON "automation_executions"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "automation_executions_trigger_entity_type_trigger_entity_id_idx" ON "automation_executions"("trigger_entity_type", "trigger_entity_id");

-- CreateIndex
CREATE INDEX "daily_summaries_workspace_id_idx" ON "daily_summaries"("workspace_id");

-- CreateIndex
CREATE INDEX "daily_summaries_workspace_id_summary_date_idx" ON "daily_summaries"("workspace_id", "summary_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_workspace_id_summary_date_key" ON "daily_summaries"("workspace_id", "summary_date");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_user_id_idx" ON "notifications"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_user_id_read_at_idx" ON "notifications"("workspace_id", "user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_idx" ON "audit_logs"("workspace_id");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_entity_type_entity_id_idx" ON "audit_logs"("workspace_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_user_id_idx" ON "audit_logs"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "deal_stages_workspace_id_idx" ON "deal_stages"("workspace_id");

-- CreateIndex
CREATE INDEX "deal_stages_workspace_id_order_idx" ON "deal_stages"("workspace_id", "order");

-- CreateIndex
CREATE INDEX "deals_workspace_id_idx" ON "deals"("workspace_id");

-- CreateIndex
CREATE INDEX "deals_workspace_id_stage_id_idx" ON "deals"("workspace_id", "stage_id");

-- CreateIndex
CREATE INDEX "deals_workspace_id_status_idx" ON "deals"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "deals_workspace_id_contact_id_idx" ON "deals"("workspace_id", "contact_id");

-- CreateIndex
CREATE INDEX "deals_workspace_id_assigned_user_id_idx" ON "deals"("workspace_id", "assigned_user_id");

-- CreateIndex
CREATE INDEX "error_reports_workspace_id_idx" ON "error_reports"("workspace_id");

-- CreateIndex
CREATE INDEX "error_reports_user_id_idx" ON "error_reports"("user_id");

-- CreateIndex
CREATE INDEX "error_reports_source_idx" ON "error_reports"("source");

-- CreateIndex
CREATE INDEX "error_reports_category_idx" ON "error_reports"("category");

-- CreateIndex
CREATE INDEX "error_reports_severity_idx" ON "error_reports"("severity");

-- CreateIndex
CREATE INDEX "error_reports_status_code_idx" ON "error_reports"("status_code");

-- CreateIndex
CREATE INDEX "error_reports_occurred_at_idx" ON "error_reports"("occurred_at");

