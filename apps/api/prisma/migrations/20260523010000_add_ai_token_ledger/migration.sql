-- Add prepaid AI token ledger, separate from contact-memory credits.
-- Production-ready hardening:
-- - AI token balance per workspace
-- - immutable-ish transaction ledger
-- - reservations for estimated token usage before model calls
-- - PayPal purchase type separation
-- - idempotency protections
-- - DB-level checks against negative balances/reservations
-- - workspace-scoped indexes

CREATE TYPE "PaypalPurchaseType" AS ENUM ('MEMORY_CREDITS', 'AI_TOKENS');

CREATE TYPE "AiTokenTransactionType" AS ENUM (
  'PURCHASE',
  'CONSUMPTION',
  'REFUND',
  'BONUS',
  'ADJUSTMENT',
  'RESERVATION_RELEASE'
);

CREATE TYPE "AiTokenReservationStatus" AS ENUM (
  'ACTIVE',
  'CONSUMED',
  'RELEASED'
);

ALTER TABLE "paypal_payment_orders"
  ADD COLUMN "tokens" INTEGER,
  ADD COLUMN "purchase_type" "PaypalPurchaseType" NOT NULL DEFAULT 'MEMORY_CREDITS';

ALTER TABLE "paypal_payment_orders"
  ADD CONSTRAINT "paypal_payment_orders_tokens_non_negative_check"
  CHECK ("tokens" IS NULL OR "tokens" >= 0);

ALTER TABLE "paypal_payment_orders"
  ADD CONSTRAINT "paypal_payment_orders_ai_tokens_requires_tokens_check"
  CHECK (
    "purchase_type" <> 'AI_TOKENS'
    OR ("tokens" IS NOT NULL AND "tokens" > 0)
  );

CREATE TABLE "workspace_ai_token_balances" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workspace_ai_token_balances_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "workspace_ai_token_balances_balance_non_negative_check"
    CHECK ("balance" >= 0),

  CONSTRAINT "workspace_ai_token_balances_reserved_non_negative_check"
    CHECK ("reserved" >= 0),

  CONSTRAINT "workspace_ai_token_balances_reserved_lte_balance_check"
    CHECK ("reserved" <= "balance")
);

CREATE TABLE "ai_token_reservations" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "AiTokenReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "description" TEXT,
  "idempotency_key" TEXT,
  "conversation_id" TEXT,
  "message_id" TEXT,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "ai_token_reservations_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "ai_token_reservations_amount_positive_check"
    CHECK ("amount" > 0),

  CONSTRAINT "ai_token_reservations_completed_status_check"
    CHECK (
      ("status" = 'ACTIVE' AND "completed_at" IS NULL)
      OR
      ("status" IN ('CONSUMED', 'RELEASED') AND "completed_at" IS NOT NULL)
    )
);

CREATE TABLE "ai_token_transactions" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "type" "AiTokenTransactionType" NOT NULL,
  "description" TEXT,
  "idempotency_key" TEXT,
  "paypal_order_id" TEXT,
  "reservation_id" TEXT,
  "conversation_id" TEXT,
  "message_id" TEXT,
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "total_tokens" INTEGER,
  "estimated" BOOLEAN NOT NULL DEFAULT false,
  "provider" TEXT,
  "model" TEXT,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_token_transactions_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "ai_token_transactions_amount_positive_check"
    CHECK ("amount" > 0),

  CONSTRAINT "ai_token_transactions_prompt_tokens_non_negative_check"
    CHECK ("prompt_tokens" IS NULL OR "prompt_tokens" >= 0),

  CONSTRAINT "ai_token_transactions_completion_tokens_non_negative_check"
    CHECK ("completion_tokens" IS NULL OR "completion_tokens" >= 0),

  CONSTRAINT "ai_token_transactions_total_tokens_non_negative_check"
    CHECK ("total_tokens" IS NULL OR "total_tokens" >= 0),

  CONSTRAINT "ai_token_transactions_consumption_requires_total_tokens_check"
    CHECK (
      "type" <> 'CONSUMPTION'
      OR ("total_tokens" IS NOT NULL AND "total_tokens" > 0)
    ),

  CONSTRAINT "ai_token_transactions_consumption_amount_matches_total_check"
    CHECK (
      "type" <> 'CONSUMPTION'
      OR "amount" = "total_tokens"
    ),

  CONSTRAINT "ai_token_transactions_purchase_requires_paypal_order_check"
    CHECK (
      "type" <> 'PURCHASE'
      OR "paypal_order_id" IS NOT NULL
    ),

  CONSTRAINT "ai_token_transactions_reservation_release_requires_reservation_check"
    CHECK (
      "type" <> 'RESERVATION_RELEASE'
      OR "reservation_id" IS NOT NULL
    )
);

CREATE UNIQUE INDEX "workspace_ai_token_balances_workspace_id_key"
  ON "workspace_ai_token_balances"("workspace_id");

CREATE INDEX "ai_token_balances_workspace_id_updated_at_idx"
  ON "workspace_ai_token_balances"("workspace_id", "updated_at" DESC);

CREATE INDEX "ai_token_reservations_workspace_id_idx"
  ON "ai_token_reservations"("workspace_id");

CREATE INDEX "ai_token_reservations_workspace_id_status_idx"
  ON "ai_token_reservations"("workspace_id", "status");

CREATE INDEX "ai_token_reservations_workspace_id_created_at_idx"
  ON "ai_token_reservations"("workspace_id", "created_at" DESC);

CREATE INDEX "ai_token_reservations_conversation_id_idx"
  ON "ai_token_reservations"("conversation_id");

CREATE INDEX "ai_token_reservations_message_id_idx"
  ON "ai_token_reservations"("message_id");

CREATE UNIQUE INDEX "ai_token_reservations_idempotency_key_key"
  ON "ai_token_reservations"("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

CREATE UNIQUE INDEX "ai_token_reservations_message_id_active_key"
  ON "ai_token_reservations"("message_id")
  WHERE "message_id" IS NOT NULL AND "status" = 'ACTIVE';

CREATE INDEX "ai_token_transactions_workspace_id_idx"
  ON "ai_token_transactions"("workspace_id");

CREATE INDEX "ai_token_transactions_workspace_id_created_at_idx"
  ON "ai_token_transactions"("workspace_id", "created_at" DESC);

CREATE INDEX "ai_token_transactions_workspace_id_type_created_at_idx"
  ON "ai_token_transactions"("workspace_id", "type", "created_at" DESC);

CREATE INDEX "ai_token_transactions_conversation_id_idx"
  ON "ai_token_transactions"("conversation_id");

CREATE INDEX "ai_token_transactions_message_id_idx"
  ON "ai_token_transactions"("message_id");

CREATE INDEX "ai_token_transactions_reservation_id_idx"
  ON "ai_token_transactions"("reservation_id");

CREATE INDEX "ai_token_transactions_paypal_order_id_idx"
  ON "ai_token_transactions"("paypal_order_id");

CREATE UNIQUE INDEX "ai_token_transactions_idempotency_key_key"
  ON "ai_token_transactions"("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

CREATE UNIQUE INDEX "ai_token_transactions_paypal_order_purchase_key"
  ON "ai_token_transactions"("paypal_order_id")
  WHERE "paypal_order_id" IS NOT NULL AND "type" = 'PURCHASE';

ALTER TABLE "workspace_ai_token_balances"
  ADD CONSTRAINT "workspace_ai_token_balances_workspace_id_fkey"
  FOREIGN KEY ("workspace_id")
  REFERENCES "workspaces"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ai_token_reservations"
  ADD CONSTRAINT "ai_token_reservations_workspace_id_fkey"
  FOREIGN KEY ("workspace_id")
  REFERENCES "workspaces"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ai_token_reservations"
  ADD CONSTRAINT "ai_token_reservations_workspace_id_balance_fkey"
  FOREIGN KEY ("workspace_id")
  REFERENCES "workspace_ai_token_balances"("workspace_id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "ai_token_transactions"
  ADD CONSTRAINT "ai_token_transactions_workspace_id_fkey"
  FOREIGN KEY ("workspace_id")
  REFERENCES "workspaces"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ai_token_transactions"
  ADD CONSTRAINT "ai_token_transactions_workspace_id_balance_fkey"
  FOREIGN KEY ("workspace_id")
  REFERENCES "workspace_ai_token_balances"("workspace_id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "ai_token_transactions"
  ADD CONSTRAINT "ai_token_transactions_reservation_id_fkey"
  FOREIGN KEY ("reservation_id")
  REFERENCES "ai_token_reservations"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;