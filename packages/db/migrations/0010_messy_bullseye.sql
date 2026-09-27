CREATE TABLE IF NOT EXISTS `courier_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`service_area` text NOT NULL,
	`bio` text,
	`vehicle_name` text,
	`vehicle_plate` text,
	`vehicle_photo_url` text,
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
CREATE UNIQUE INDEX IF NOT EXISTS `courier_profile_user_unique` ON `courier_profile` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `courier_profile_directory_idx` ON `courier_profile` (`verification_status`,`is_available`);
