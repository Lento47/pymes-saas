CREATE TABLE `price_book` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`weekly_minor` integer NOT NULL,
	`monthly_minor` integer NOT NULL,
	`effective_from` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `price_book_effective_idx` ON `price_book` (`effective_from`);--> statement-breakpoint
CREATE TABLE `subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`plan` text NOT NULL,
	`price_book_id` text NOT NULL,
	`price_minor` integer,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`period_start` integer,
	`period_end` integer,
	`graced_until` integer,
	`last_paid_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`price_book_id`) REFERENCES `price_book`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_business_id_unique` ON `subscription` (`business_id`);--> statement-breakpoint
CREATE INDEX `subscription_status_idx` ON `subscription` (`status`);--> statement-breakpoint
CREATE INDEX `subscription_period_end_idx` ON `subscription` (`period_end`);--> statement-breakpoint
ALTER TABLE `business` ADD `plan` text DEFAULT 'WEEKLY' NOT NULL;
--> statement-breakpoint
DROP TABLE `payout`;