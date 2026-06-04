-- Add email verification fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token" TEXT;

-- Unique index on verification token for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_verification_token_key"
  ON "users"("email_verification_token")
  WHERE "email_verification_token" IS NOT NULL;

-- Existing users are considered verified (they were registered before this requirement)
UPDATE "users" SET "email_verified" = true WHERE "email_verified" = false;
