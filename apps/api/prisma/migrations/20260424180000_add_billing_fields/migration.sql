-- Add billing fields to workspaces table
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'STARTER',
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create index for stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer_id ON workspaces(stripe_customer_id);

-- Add billing fields to workspace_subscriptions table
ALTER TABLE workspace_subscriptions
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'TRIALING',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Create index for stripe subscription lookup
CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_stripe_id ON workspace_subscriptions(stripe_subscription_id);
