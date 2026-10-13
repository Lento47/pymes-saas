CREATE TABLE `idea` (
	`id` text PRIMARY KEY NOT NULL,
	-- Nullable and SET NULL, unlike support_ticket.opened_by which is NOT NULL/restrict.
	-- An idea outlives the account that produced it: the person is gone and the
	-- feedback is still the thing an operator has to look at.
	`user_id` text,
	-- Deliberately NO foreign key. This is a filter — "ideas from someone on this
	-- shop" — and not an ownership claim. An FK is what would put this row in
	-- REASON_REQUIRED_ACTIONS' way and make an idea block a business delete, which
	-- support_ticket legitimately does and an idea must not.
	`business_id` text,
	-- Who the submitter was at write time. Stored, not recomputed, so the role
	-- survives a membership that no longer exists.
	`role_at_submit` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	-- OPEN or CLOSED. The client writes OPEN and never touches the column again.
	`status` text DEFAULT 'OPEN' NOT NULL,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
-- The queue's own ordering, so "the ideas still open, newest first" is an index
-- rather than a sort the Worker does on every page.
CREATE INDEX `idea_status_created` ON `idea` (`status`,`created_at`);--> statement-breakpoint
-- The submitter's own list.
CREATE INDEX `idea_user_created` ON `idea` (`user_id`,`created_at`);
