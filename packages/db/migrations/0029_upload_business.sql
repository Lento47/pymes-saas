-- Attribute stored objects to the tenant whose plan counts them (`PLAN_LIMITS.storageBytes`).
--
-- `upload` rows carry only `ownerUserId`, so per-shop bytes cannot be summed. These two
-- columns close that gap: `business_id` is written by `uploads.create` for shop pictures
-- from here on, and the backfill below attributes the rows that already exist by joining
-- on the stored path - `upload.key` and every `*_url` column hold the identical
-- `/files/:id` string, so the join is an equality, not a prefix match.
--
-- Category images are deliberately NOT backfilled: `category` has no tenant, so those
-- objects are platform-owned and no plan counts them. Avatars and courier vehicle photos
-- stay NULL for the same reason.
ALTER TABLE `upload` ADD `business_id` text REFERENCES `business`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `upload` ADD `purpose` text;
--> statement-breakpoint
UPDATE `upload` SET `business_id` = (SELECT `business_id` FROM `product` WHERE `product`.`image_url` = `upload`.`key` LIMIT 1) WHERE `business_id` IS NULL;
--> statement-breakpoint
UPDATE `upload` SET `business_id` = (SELECT `p`.`business_id` FROM `product` AS `p`, json_each(`p`.`images`) AS `j` WHERE json_valid(`p`.`images`) AND `j`.`value` = `upload`.`key` LIMIT 1) WHERE `business_id` IS NULL;
--> statement-breakpoint
UPDATE `upload` SET `business_id` = (SELECT `business_id` FROM `promotion` WHERE `promotion`.`image_url` = `upload`.`key` LIMIT 1) WHERE `business_id` IS NULL;
--> statement-breakpoint
UPDATE `upload` SET `business_id` = (SELECT `id` FROM `business` WHERE `business`.`logo_url` = `upload`.`key` LIMIT 1) WHERE `business_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `upload_business_id` ON `upload` (`business_id`);
