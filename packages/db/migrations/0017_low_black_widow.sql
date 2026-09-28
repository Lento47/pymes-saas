CREATE TABLE `account_deletion_request` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`requested_at` integer NOT NULL,
	`scheduled_for` integer NOT NULL,
	`completed_at` integer,
	`last_error` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_deletion_due_idx` ON `account_deletion_request` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `device_push_token` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `device_push_token_user_idx` ON `device_push_token` (`user_id`);--> statement-breakpoint
CREATE TABLE `push_delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`receipt_id` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_delivery_event_token_unique` ON `push_delivery` (`event_id`,`token`);--> statement-breakpoint
CREATE INDEX `push_delivery_pending_idx` ON `push_delivery` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `push_delivery_receipt_unique` ON `push_delivery` (`receipt_id`);--> statement-breakpoint
ALTER TABLE `order` ADD `courier_accuracy` real;--> statement-breakpoint
ALTER TABLE `order` ADD `courier_heading` real;--> statement-breakpoint
ALTER TABLE `order` ADD `courier_speed` real;