CREATE TABLE `address` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text,
	`line1` text NOT NULL,
	`line2` text,
	`city` text NOT NULL,
	`region` text,
	`country` text NOT NULL,
	`postal_code` text,
	`lat` real,
	`lng` real,
	`phone` text,
	`instructions` text,
	`is_default` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `address_user_idx` ON `address` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`meta` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_target_idx` ON `audit_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_created_idx` ON `audit_log` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `business` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`logo_url` text,
	`cover_url` text,
	`phone` text,
	`email` text,
	`category_id` text,
	`line1` text,
	`line2` text,
	`city` text,
	`region` text,
	`country` text,
	`postal_code` text,
	`lat` real,
	`lng` real,
	`geohash` text,
	`currency` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`rating_avg` real DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`delivery_enabled` integer DEFAULT false NOT NULL,
	`pickup_enabled` integer DEFAULT true NOT NULL,
	`delivery_fee_minor` integer DEFAULT 0 NOT NULL,
	`delivery_radius_km` real,
	`prep_time_minutes` integer,
	`min_order_minor` integer DEFAULT 0 NOT NULL,
	`hours` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_slug_unique` ON `business` (`slug`);--> statement-breakpoint
CREATE INDEX `business_geohash_status_idx` ON `business` (`geohash`,`status`);--> statement-breakpoint
CREATE TABLE `cart` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`currency` text NOT NULL,
	`promotion_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cart_user_status_idx` ON `cart` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `cart_item` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_minor` integer NOT NULL,
	`options` text,
	`options_hash` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`cart_id`) REFERENCES `cart`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cart_item_cart_product_options_unique` ON `cart_item` (`cart_id`,`product_id`,`options_hash`);--> statement-breakpoint
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`icon_name` text,
	`image_url` text,
	`parent_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_slug_unique` ON `category` (`slug`);--> statement-breakpoint
CREATE TABLE `favorite` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text,
	`product_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorite_user_business_unique` ON `favorite` (`user_id`,`business_id`) WHERE product_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX `favorite_user_product_unique` ON `favorite` (`user_id`,`product_id`) WHERE business_id is null;--> statement-breakpoint
CREATE TABLE `membership` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_business_user_unique` ON `membership` (`business_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `membership_user_idx` ON `membership` (`user_id`);--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`dedupe_key` text,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_user_created_idx` ON `notification` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_dedupe_unique` ON `notification` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `order` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`customer_id` text NOT NULL,
	`business_id` text NOT NULL,
	`address_id` text,
	`fulfilment` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`payment_method` text NOT NULL,
	`payment_status` text DEFAULT 'UNPAID' NOT NULL,
	`currency` text NOT NULL,
	`subtotal_minor` integer NOT NULL,
	`discount_minor` integer DEFAULT 0 NOT NULL,
	`delivery_fee_minor` integer DEFAULT 0 NOT NULL,
	`tax_minor` integer DEFAULT 0 NOT NULL,
	`tip_minor` integer DEFAULT 0 NOT NULL,
	`total_minor` integer NOT NULL,
	`notes` text,
	`scheduled_for` integer,
	`placed_at` integer NOT NULL,
	`accepted_at` integer,
	`ready_at` integer,
	`completed_at` integer,
	`cancelled_at` integer,
	`cancel_reason` text,
	`courier_name` text,
	`courier_phone` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`address_id`) REFERENCES `address`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_reference_unique` ON `order` (`reference`);--> statement-breakpoint
CREATE INDEX `order_customer_placed_idx` ON `order` (`customer_id`,`placed_at`);--> statement-breakpoint
CREATE INDEX `order_business_status_placed_idx` ON `order` (`business_id`,`status`,`placed_at`);--> statement-breakpoint
CREATE TABLE `order_event` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor` text NOT NULL,
	`actor_user_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `order`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_event_order_created_idx` ON `order_event` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_item` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name_snapshot` text NOT NULL,
	`image_url_snapshot` text,
	`quantity` integer NOT NULL,
	`unit_price_minor` integer NOT NULL,
	`options` text,
	`line_total_minor` integer NOT NULL,
	`notes` text,
	FOREIGN KEY (`order_id`) REFERENCES `order`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `payout` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`gross_minor` integer NOT NULL,
	`platform_fee_minor` integer NOT NULL,
	`net_minor` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`paid_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `product` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`description` text,
	`image_url` text,
	`images` text,
	`price_minor` integer NOT NULL,
	`compare_at_price_minor` integer,
	`currency` text NOT NULL,
	`sku` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`track_inventory` integer DEFAULT false NOT NULL,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`prep_time_minutes` integer,
	`tags` text,
	`rating_avg` real DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`sold_count` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `product_business_status_idx` ON `product` (`business_id`,`status`);--> statement-breakpoint
CREATE INDEX `product_category_status_idx` ON `product` (`category_id`,`status`);--> statement-breakpoint
CREATE TABLE `product_option` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`price_delta_minor` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `product_option_group`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_option_group` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`is_required` integer DEFAULT false NOT NULL,
	`min_select` integer DEFAULT 0 NOT NULL,
	`max_select` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `promotion` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	`min_order_minor` integer,
	`max_redemptions` integer,
	`redemptions` integer DEFAULT 0 NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promotion_business_code_unique` ON `promotion` (`business_id`,`code`);--> statement-breakpoint
CREATE TABLE `review` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`business_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`product_id` text,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `order`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_order_unique` ON `review` (`order_id`);--> statement-breakpoint
CREATE INDEX `review_business_created_idx` ON `review` (`business_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `upload` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`owner_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_key_unique` ON `upload` (`key`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`phone` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`suspended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);