ALTER TABLE `business` ADD `merchant_covers_delivery` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `order` ADD `courier_fee_minor` integer;
--> statement-breakpoint
ALTER TABLE `order` ADD `merchant_covers_delivery` integer NOT NULL DEFAULT 0;
