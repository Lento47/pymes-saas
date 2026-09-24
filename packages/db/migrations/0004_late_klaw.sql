ALTER TABLE `review` ADD `reply_text` text;--> statement-breakpoint
ALTER TABLE `review` ADD `replied_at` integer;--> statement-breakpoint
-- Backfill: replies used to live as notification rows keyed `REVIEW_REPLY:<reviewId>`.
-- New writes go on the review itself, so existing answers move house once, here,
-- rather than vanishing from storefronts the day the readers switch tables.
UPDATE `review` SET `reply_text` = (SELECT `body` FROM `notification` WHERE `dedupe_key` = 'REVIEW_REPLY:' || `review`.`id`), `replied_at` = (SELECT `created_at` FROM `notification` WHERE `dedupe_key` = 'REVIEW_REPLY:' || `review`.`id`) WHERE EXISTS (SELECT 1 FROM `notification` WHERE `dedupe_key` = 'REVIEW_REPLY:' || `review`.`id`);