CREATE TABLE `merchant_category` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL REFERENCES `business`(`id`) ON DELETE CASCADE,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `merchant_category_business_idx` ON `merchant_category` (`business_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchant_category_name_unique` ON `merchant_category` (`business_id`, lower(`name`));
--> statement-breakpoint
ALTER TABLE `product` ADD COLUMN `merchant_category_id` text REFERENCES `merchant_category`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `product_merchant_category_idx` ON `product` (`merchant_category_id`);
