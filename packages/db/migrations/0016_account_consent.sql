-- The ledger of what each account holder agreed to, and when.
--
-- Both timestamps are NOT NULL. A row exists because an agreement was captured,
-- so a missing row means no agreement; a nullable timestamp inside an existing
-- row would instead claim half an agreement.
--
-- No backfill. New rows are written only after both assertions are accepted, so
-- inventing rows for older accounts would record consent those users did not give.
CREATE TABLE `account_consent` (
	`user_id` text PRIMARY KEY NOT NULL,
	`terms_accepted_at` integer NOT NULL,
	`age_confirmed_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_reason` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
