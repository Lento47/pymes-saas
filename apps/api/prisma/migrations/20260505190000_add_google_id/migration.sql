ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users" ("google_id");
