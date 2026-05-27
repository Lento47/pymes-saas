-- CreateTable: platform_settings (singleton row)
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id"                TEXT NOT NULL DEFAULT 'singleton',
    "mimo_api_key_enc"  TEXT,
    "admin_phones"      TEXT,
    "admin_ai_model"    TEXT,
    "github_token_enc"  TEXT,
    "github_repo_owner" TEXT,
    "github_repo_name"  TEXT,
    "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id"     TEXT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
