CREATE TABLE `outbox_event` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`aggregate_version` integer NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`payload` text,
	`published_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_event_id_unique` ON `outbox_event` (`event_id`);--> statement-breakpoint
CREATE INDEX `outbox_pending_idx` ON `outbox_event` (`published_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `outbox_aggregate_idx` ON `outbox_event` (`aggregate_type`,`aggregate_id`,`aggregate_version`);--> statement-breakpoint
ALTER TABLE `order` ADD `version` integer DEFAULT 1 NOT NULL;