-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_id_key" ON "users"("telegram_id");
