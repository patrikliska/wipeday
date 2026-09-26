CREATE TABLE `furnace_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`input` text NOT NULL,
	`output` text NOT NULL,
	`amount` integer NOT NULL,
	`started_at` integer NOT NULL,
	`collected` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `furnace_jobs_player` ON `furnace_jobs` (`player_id`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`player_id` integer NOT NULL,
	`item_id` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`player_id`, `item_id`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `bases` ADD `build_tier` text;--> statement-breakpoint
ALTER TABLE `bases` ADD `build_ends_at` integer;--> statement-breakpoint
ALTER TABLE `bases` ADD `upkeep_paid_until` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bases` ADD `furnace_id` text;