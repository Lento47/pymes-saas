-- Regenerate all workspace slugs to random base64url format for privacy
-- Replaces email-derived slugs (e.g., 'lejzer-1776996029881') with random IDs (e.g., 'TooMeGpVud_c')

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update all workspaces with unique random base64url slugs
-- Uses gen_random_bytes(9) for ~72 bits of entropy
UPDATE workspaces
SET slug = REPLACE(REPLACE(RTRIM(ENCODE(gen_random_bytes(9), 'base64'), '='), '+', '-'), '/', '_')
WHERE id IS NOT NULL;