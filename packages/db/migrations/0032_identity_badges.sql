-- Verified profiles and organization affiliations, part 1 of 2 (schema).
--
-- Hand-written. `drizzle-kit generate` must not be run against this repository:
-- `migrations/meta/` stops at `0020_snapshot.json` while hand-written migrations
-- exist through `0031`, so a generate would diff against a twenty-migration-old
-- snapshot and try to recreate ten already-applied files. That is a production
-- outage, and `drizzle.config.ts` says so.
--
-- Every statement here is additive: ADD COLUMN, CREATE TABLE, CREATE INDEX. No
-- DROP, no table rebuild, no data rewrite, so the migration is safe to apply to
-- a live database and its only rollback question is which statements to reverse.
--
-- The two defaults are what make this a no-op for existing rows:
--   * `business.verification_status` defaults to 'NONE' — no business has ever
--     been through the new review, so there is nothing to backfill.
--   * `membership.status` defaults to 'ACTIVE' — before this column there was no
--     state for a membership to be in *but* active, so the default is the
--     previous behaviour written down rather than a guess about it.
--
-- `is_verified` is deliberately untouched. It becomes a projection of
-- `verification_status` written in the same batch, which is why the two can be
-- read side by side during the transition without disagreeing.

ALTER TABLE `business` ADD `verification_status` text DEFAULT 'NONE' NOT NULL;
--> statement-breakpoint
ALTER TABLE `business` ADD `verification_level` text DEFAULT 'NONE' NOT NULL;
--> statement-breakpoint
ALTER TABLE `business` ADD `verified_at` integer;
--> statement-breakpoint
ALTER TABLE `business` ADD `verification_expires_at` integer;
--> statement-breakpoint
ALTER TABLE `membership` ADD `status` text DEFAULT 'ACTIVE' NOT NULL;
--> statement-breakpoint
ALTER TABLE `membership` ADD `invited_by_user_id` text REFERENCES `user`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `membership` ADD `accepted_at` integer;
--> statement-breakpoint
ALTER TABLE `membership` ADD `revoked_at` integer;
--> statement-breakpoint
ALTER TABLE `membership` ADD `expires_at` integer;
--> statement-breakpoint
CREATE TABLE `business_verification_request` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL REFERENCES `business`(`id`) ON DELETE CASCADE,
	`submitted_by_user_id` text REFERENCES `user`(`id`) ON DELETE SET NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`legal_name` text,
	`country` text,
	`tax_id` text,
	`support_email` text,
	`domain` text,
	`domain_evidence_url` text,
	`documents` text,
	`review_note` text,
	`reviewed_by_user_id` text REFERENCES `user`(`id`) ON DELETE SET NULL,
	`reviewed_at` integer,
	`decision_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_verification_request_open_unique` ON `business_verification_request` (`business_id`) WHERE `status` = 'PENDING';
--> statement-breakpoint
CREATE INDEX `business_verification_request_business_idx` ON `business_verification_request` (`business_id`, `status`, `created_at`);
--> statement-breakpoint
CREATE INDEX `business_verification_request_queue_idx` ON `business_verification_request` (`status`, `created_at`);
--> statement-breakpoint
CREATE INDEX `membership_user_status_idx` ON `membership` (`user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `membership_business_status_idx` ON `membership` (`business_id`, `status`);
