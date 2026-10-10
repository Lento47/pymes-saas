CREATE TABLE `delivery_quote` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`cart_id` text NOT NULL REFERENCES `cart`(`id`) ON DELETE CASCADE,
	`location_id` text NOT NULL REFERENCES `merchant_location`(`id`) ON DELETE CASCADE,
	`address_id` text NOT NULL REFERENCES `address`(`id`) ON DELETE CASCADE,
	`cart_updated_at` integer NOT NULL,
	`cart_fingerprint` text NOT NULL,
	`promotion_code` text,
	`route_input_key` text NOT NULL,
	`pricing_version` text NOT NULL,
	`currency` text NOT NULL,
	`subtotal_minor` integer NOT NULL,
	`discount_minor` integer NOT NULL,
	`base_fee_minor` integer NOT NULL,
	`fee_minor` integer NOT NULL,
	`total_minor` integer NOT NULL,
	`distance_meters` real NOT NULL,
	`duration_seconds` real NOT NULL,
	`geometry` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `delivery_quote_cart_expiry_idx` ON `delivery_quote` (`cart_id`, `expires_at`);
--> statement-breakpoint
CREATE INDEX `delivery_quote_user_expiry_idx` ON `delivery_quote` (`user_id`, `expires_at`);
--> statement-breakpoint
ALTER TABLE `order` ADD `delivery_pricing_version` text;
--> statement-breakpoint
ALTER TABLE `order` ADD `delivery_quote_id` text;
--> statement-breakpoint
ALTER TABLE `order` ADD `route_distance_meters` real;
--> statement-breakpoint
ALTER TABLE `order` ADD `route_duration_seconds` real;
--> statement-breakpoint
ALTER TABLE `order` ADD `route_geometry` text;
--> statement-breakpoint
ALTER TABLE `order` ADD `delivery_fee_base_minor` integer;
--> statement-breakpoint
ALTER TABLE `order` ADD `delivery_operational_discount_minor` integer;
