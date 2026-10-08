CREATE TABLE `crash_report` (
	`id` text PRIMARY KEY NOT NULL,
	-- Nullable and SET NULL, unlike support_ticket.opened_by which is NOT NULL/restrict.
	-- A crash outlives the account that produced it: the reporter is gone and the release still
	-- needs fixing. Nobody is accountable for a stack trace, which is why the conversation's
	-- constraint is the wrong one here.
	`user_id` text,
	-- Deliberately NO foreign key. This is a filter - "crashes seen on this shop's screen" -
	-- and not an ownership claim. An FK is what would put this row in REASON_REQUIRED_ACTIONS'
	-- way and make a crash block a business delete, which support_ticket legitimately does and
	-- a crash must not.
	`business_id` text,
	`source` text NOT NULL,
	`category` text NOT NULL,
	`severity` text DEFAULT 'ERROR' NOT NULL,
	`title` text,
	`message` text NOT NULL,
	`stack` text,
	-- The screen it happened on, as a route.
	`route` text,
	`app_version` text,
	-- Indexed: "which version broke this" is the question that decides whether the next one
	-- contains the fix, and a report that cannot be found by its release is one nobody reopens.
	`build_number` text,
	`context_json` text,
	-- The operator's lifecycle. Same four words as support_ticket.status because the operator
	-- is one person; the client writes OPEN and never touches the column again.
	`status` text DEFAULT 'OPEN' NOT NULL,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
-- The queue's own ordering, so "the crashes still open, newest first" is an index rather than
-- a sort the Worker does on every page. Same shape as
-- support_ticket_business_status_created, without the business.
CREATE INDEX `crash_report_status_created` ON `crash_report` (`status`,`created_at`);--> statement-breakpoint
-- "Is this our problem on this platform" - the second question after "is it still open".
CREATE INDEX `crash_report_source` ON `crash_report` (`source`);--> statement-breakpoint
CREATE INDEX `crash_report_build` ON `crash_report` (`build_number`);
