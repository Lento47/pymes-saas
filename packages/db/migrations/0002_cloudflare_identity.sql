CREATE TABLE auth_session (id TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT);
CREATE INDEX auth_session_user ON auth_session(user_id);
CREATE TABLE auth_account (id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, provider_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, password TEXT, access_token TEXT, refresh_token TEXT, id_token TEXT, scope TEXT, access_token_expires_at INTEGER, refresh_token_expires_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX auth_account_user ON auth_account(user_id);
CREATE UNIQUE INDEX auth_account_provider ON auth_account(provider_id, account_id);
CREATE TABLE auth_verification (id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX auth_verification_identifier ON auth_verification(identifier);
CREATE TABLE auth_rate_limit (id TEXT PRIMARY KEY NOT NULL, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, last_request INTEGER NOT NULL);
