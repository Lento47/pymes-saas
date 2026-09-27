CREATE TABLE `courier_presence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`accuracy_meters` real,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courier_presence_user_unique` ON `courier_presence` (`user_id`);--> statement-breakpoint
CREATE INDEX `courier_presence_updated_idx` ON `courier_presence` (`updated_at`);--> statement-breakpoint
CREATE TABLE `delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`business_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`courier_user_id` text,
	`status` text DEFAULT 'SEARCHING' NOT NULL,
	`pickup_name` text NOT NULL,
	`pickup_line1` text NOT NULL,
	`pickup_line2` text,
	`pickup_city` text NOT NULL,
	`pickup_region` text NOT NULL,
	`pickup_postal_code` text,
	`pickup_lat` real,
	`pickup_lng` real,
	`pickup_phone` text,
	`pickup_instructions` text,
	`dropoff_name` text NOT NULL,
	`dropoff_line1` text NOT NULL,
	`dropoff_line2` text,
	`dropoff_city` text NOT NULL,
	`dropoff_region` text NOT NULL,
	`dropoff_postal_code` text,
	`dropoff_lat` real,
	`dropoff_lng` real,
	`dropoff_phone` text,
	`dropoff_instructions` text,
	`accepted_at` integer,
	`started_to_pickup_at` integer,
	`arrived_pickup_at` integer,
	`picked_up_at` integer,
	`delivered_at` integer,
	`cancelled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `order`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`courier_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_order_unique` ON `delivery` (`order_id`);--> statement-breakpoint
CREATE INDEX `delivery_courier_status_idx` ON `delivery` (`courier_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `delivery_business_status_idx` ON `delivery` (`business_id`,`status`);--> statement-breakpoint
CREATE TABLE `delivery_offer` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_id` text NOT NULL,
	`courier_user_id` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`distance_to_pickup_km` real,
	`workload_at_offer` integer DEFAULT 0 NOT NULL,
	`rating_at_offer` real,
	`expires_at` integer NOT NULL,
	`responded_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`delivery_id`) REFERENCES `delivery`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`courier_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_offer_courier_unique` ON `delivery_offer` (`delivery_id`,`courier_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_offer_pending_unique` ON `delivery_offer` (`delivery_id`) WHERE "delivery_offer"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_offer_accepted_unique` ON `delivery_offer` (`delivery_id`) WHERE "delivery_offer"."status" = 'ACCEPTED';--> statement-breakpoint
CREATE INDEX `delivery_offer_courier_status_idx` ON `delivery_offer` (`courier_user_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `delivery_rating` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_id` text NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`from_role` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`delivery_id`) REFERENCES `delivery`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`to_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_rating_direction_unique` ON `delivery_rating` (`delivery_id`,`from_role`);--> statement-breakpoint
CREATE INDEX `delivery_rating_recipient_idx` ON `delivery_rating` (`to_user_id`,`created_at`);