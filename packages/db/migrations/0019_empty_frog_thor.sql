CREATE TABLE `support_ticket` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`opened_by` text NOT NULL,
	`category` text NOT NULL,
	`subject` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opened_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `support_ticket_business_id` ON `support_ticket` (`business_id`);--> statement-breakpoint
CREATE INDEX `support_ticket_status` ON `support_ticket` (`status`);--> statement-breakpoint
CREATE INDEX `support_ticket_business_status_created` ON `support_ticket` (`business_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `support_ticket_message` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`author_id` text,
	`from_support` integer DEFAULT false NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `support_ticket`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `support_ticket_message_ticket_id` ON `support_ticket_message` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `support_ticket_message_thread` ON `support_ticket_message` (`ticket_id`,`created_at`,`id`);