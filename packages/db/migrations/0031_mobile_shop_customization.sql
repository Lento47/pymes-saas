CREATE TABLE `merchant_dashboard_preference` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL REFERENCES `business`(`id`) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`configuration` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchant_dashboard_preference_user_business_unique` ON `merchant_dashboard_preference` (`user_id`, `business_id`);
--> statement-breakpoint
CREATE TABLE `mobile_shop_appearance` (
	`business_id` text PRIMARY KEY NOT NULL REFERENCES `business`(`id`) ON DELETE CASCADE,
	`published` text,
	`draft` text,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL
);
