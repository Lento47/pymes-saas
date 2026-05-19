-- Add billing-related columns to workspaces table
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "plan" VARCHAR(20) NOT NULL DEFAULT 'STARTER';
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT;

-- Add columns to workspace_subscriptions table
ALTER TABLE "workspace_subscriptions" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "workspace_subscriptions" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3);
ALTER TABLE "workspace_subscriptions" ADD COLUMN IF NOT EXISTS "current_period_start" TIMESTAMP(3);
ALTER TABLE "workspace_subscriptions" ADD COLUMN IF NOT EXISTS "current_period_end" TIMESTAMP(3);
ALTER TABLE "workspace_subscriptions" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT;

-- Create index for stripe_customer_id lookups
CREATE INDEX IF NOT EXISTS "workspaces_stripe_customer_id_idx" ON "workspaces"("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "workspace_subscriptions_stripe_subscription_id_idx" ON "workspace_subscriptions"("stripe_subscription_id");
