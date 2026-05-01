-- CreateIndex
CREATE INDEX "refresh_tokens_family_revoked_at_idx" ON "refresh_tokens"("family", "revoked_at");
