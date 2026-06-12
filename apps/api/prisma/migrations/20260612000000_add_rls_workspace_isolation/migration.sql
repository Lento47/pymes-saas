-- ============================================================
-- Migration: 20260612000000_add_rls_workspace_isolation
-- Purpose: Enable Postgres Row-Level Security (RLS) on all
--          workspace-scoped tables to enforce tenant isolation
--          at the database layer.
--
-- How it works:
--   1. RLS is enabled on each critical table.
--   2. A PERMISSIVE policy checks workspace_id against the
--      session-local config variable `app.workspace_id`.
--   3. If `app.workspace_id` is NULL or empty, NULLIF returns
--      NULL and no rows match — safe by default.
--   4. The app DB role (non-superuser) is subject to RLS.
--      Platform admin / migration runs as superuser which
--      bypasses RLS by default (no FORCE ROW LEVEL SECURITY).
--   5. PrismaService.setWorkspaceContext(id) must be called
--      before tenant-scoped queries.
-- ============================================================

-- ─── conversations ───────────────────────────────────────────
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "conversations"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── messages ────────────────────────────────────────────────
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "messages"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── contacts ────────────────────────────────────────────────
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "contacts"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── invoices ────────────────────────────────────────────────
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "invoices"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── invoice_lines ───────────────────────────────────────────
ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "invoice_lines"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── invoice_payments ────────────────────────────────────────
ALTER TABLE "invoice_payments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "invoice_payments"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── tasks ───────────────────────────────────────────────────
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "tasks"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── deals ───────────────────────────────────────────────────
ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "deals"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── deal_stages ─────────────────────────────────────────────
ALTER TABLE "deal_stages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "deal_stages"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── channels ────────────────────────────────────────────────
ALTER TABLE "channels" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "channels"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── documents ───────────────────────────────────────────────
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "documents"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── automation_rules ────────────────────────────────────────
ALTER TABLE "automation_rules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "automation_rules"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── automation_executions ───────────────────────────────────
ALTER TABLE "automation_executions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "automation_executions"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── workspace_users ─────────────────────────────────────────
ALTER TABLE "workspace_users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "workspace_users"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── departments ─────────────────────────────────────────────
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "departments"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── department_members ──────────────────────────────────────
ALTER TABLE "department_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "department_members"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── routing_rules ───────────────────────────────────────────
ALTER TABLE "routing_rules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "routing_rules"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── notifications ───────────────────────────────────────────
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "notifications"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── audit_logs ──────────────────────────────────────────────
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "audit_logs"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── daily_summaries ─────────────────────────────────────────
ALTER TABLE "daily_summaries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "daily_summaries"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── payment_reminders ───────────────────────────────────────
ALTER TABLE "payment_reminders" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "payment_reminders"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── products ────────────────────────────────────────────────
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "products"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── product_categories ──────────────────────────────────────
ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "product_categories"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── stock_movements ─────────────────────────────────────────
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "stock_movements"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── refresh_tokens ──────────────────────────────────────────
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "refresh_tokens"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── invitations ─────────────────────────────────────────────
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "invitations"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── billing_invoices ────────────────────────────────────────
-- billing_invoices has workspace_id but is an internal billing
-- record — still scoped for safety
ALTER TABLE "billing_invoices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "billing_invoices"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── workspace_subscriptions ─────────────────────────────────
ALTER TABLE "workspace_subscriptions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "workspace_subscriptions"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── billing_events ──────────────────────────────────────────
ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON "billing_events"
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
  );

-- ─── NOTE: Tables intentionally NOT subject to RLS ───────────
--
-- "workspaces"         — identity table; app always scopes by workspace.id
-- "users"              — global user registry; access controlled at app layer
-- "webhook_events"     — ingestion queue; workspace_id is nullable/provisional
-- "stripe_events"      — platform-level event log; workspace_id is nullable
-- "error_reports"      — platform-level diagnostic; workspace_id is nullable
-- "workspace_tax_profile" — 1:1 with workspace; always joined via workspace
--
-- These tables are accessed in contexts where app.workspace_id is not
-- always set (e.g., webhook ingestion, auth flows, platform admin).
-- They rely on app-layer scoping and are lower risk for cross-tenant leakage.
