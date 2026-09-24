CREATE TABLE `merchant_location` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`line1` text,
	`line2` text,
	`city` text,
	`region` text,
	`country` text,
	`postal_code` text,
	`lat` real,
	`lng` real,
	`hours` text,
	`pause_reason` text,
	`paused_at` integer,
	`resume_at` integer,
	`is_offline` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `business`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `merchant_location_business_idx` ON `merchant_location` (`business_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `merchant_location_default_unique` ON `merchant_location` (`business_id`) WHERE "merchant_location"."is_default" = 1;--> statement-breakpoint
ALTER TABLE `order` ADD `location_id` text REFERENCES merchant_location(id);--> statement-breakpoint
CREATE INDEX `order_location_status_placed_idx` ON `order` (`location_id`,`status`,`placed_at`);
--> statement-breakpoint
INSERT INTO `merchant_location` (`id`, `business_id`, `name`, `is_default`, `line1`, `line2`, `city`, `region`, `country`, `postal_code`, `lat`, `lng`, `created_at`, `updated_at`)
SELECT 'loc_' || `id`, `id`, `name`, 1, `line1`, `line2`, `city`, `region`, `country`, `postal_code`, `lat`, `lng`, `created_at`, `updated_at` FROM `business`;
--> statement-breakpoint
UPDATE `order` SET `location_id` = 'loc_' || `business_id` WHERE `location_id` IS NULL;
--> statement-breakpoint
CREATE TRIGGER `order_location_accepting_guard` BEFORE INSERT ON `order`
WHEN NEW.`location_id` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'LOCATION_NOT_ACCEPTING_ORDERS')
  WHERE NOT EXISTS (
    SELECT 1 FROM `merchant_location` AS loc
    INNER JOIN `business` AS biz ON biz.`id` = loc.`business_id`
    WHERE loc.`id` = NEW.`location_id`
      AND loc.`business_id` = NEW.`business_id`
      AND biz.`status` = 'ACTIVE'
      AND loc.`is_offline` = 0
      AND (loc.`pause_reason` IS NULL OR (loc.`resume_at` IS NOT NULL AND loc.`resume_at` <= unixepoch('now') * 1000))
  );
END;
