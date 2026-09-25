CREATE TABLE `courier_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`courier_user_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`invited_by_user_id` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`expires_at` integer NOT NULL,
	`responded_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`courier_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `courier_profile`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courier_invite_pending_unique` ON `courier_invite` (`business_id`,`courier_user_id`) WHERE "courier_invite"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX `courier_invite_business_status_idx` ON `courier_invite` (`business_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `courier_invite_courier_status_idx` ON `courier_invite` (`courier_user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `courier_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`service_area` text NOT NULL,
	`bio` text,
	`is_available` integer DEFAULT true NOT NULL,
	`verification_status` text DEFAULT 'PENDING' NOT NULL,
	`reviewed_at` integer,
	`reviewed_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courier_profile_user_unique` ON `courier_profile` (`user_id`);--> statement-breakpoint
CREATE INDEX `courier_profile_directory_idx` ON `courier_profile` (`verification_status`,`is_available`);