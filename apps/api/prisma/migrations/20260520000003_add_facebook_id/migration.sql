-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "facebook_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_facebook_id_key" ON "users"("facebook_id");
