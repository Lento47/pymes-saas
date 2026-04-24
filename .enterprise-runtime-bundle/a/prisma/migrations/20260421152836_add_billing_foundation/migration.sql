-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('MANUAL', 'STRIPE', 'PAYPAL', 'BAC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY', 'ONE_TIME', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WorkspaceSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELLED', 'EXPIRED', 'MANUAL');

-- CreateTable
CREATE TABLE "workspace_subscriptions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'MANUAL',
    "status" "WorkspaceSubscriptionStatus" NOT NULL DEFAULT 'MANUAL',
    "plan" "WorkspacePlan" NOT NULL,
    "billing_interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "external_reference" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "trial_ends_at" TIMESTAMP(3),
    "notes" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "provider" "BillingProvider" NOT NULL DEFAULT 'MANUAL',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "event_type" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "actor_user_id" TEXT,
    "applied_plan" "WorkspacePlan",
    "payload_json" JSONB,
    "processed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "billing_events_provider_provider_event_id_key" ON "billing_events"("provider", "provider_event_id");

-- AddForeignKey
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "workspace_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
