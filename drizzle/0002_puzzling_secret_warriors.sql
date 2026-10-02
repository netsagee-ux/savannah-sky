CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'gbp' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`session_id` text,
	`mode` text NOT NULL,
	`created_at` text NOT NULL,
	`paid_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_order_user` ON `orders` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `lessons` ADD `video_url` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `resource_url` text;