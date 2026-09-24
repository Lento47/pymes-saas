ALTER TABLE `user` ADD `notify_order_updates` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `notify_review_replies` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `show_review_avatar` integer DEFAULT true NOT NULL;