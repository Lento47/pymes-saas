ALTER TABLE `order` ADD `courier_user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `order` ADD `courier_lat` real;--> statement-breakpoint
ALTER TABLE `order` ADD `courier_lng` real;--> statement-breakpoint
ALTER TABLE `order` ADD `courier_at` integer;