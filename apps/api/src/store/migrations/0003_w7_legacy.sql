CREATE TABLE `hall_of_fame` (
	`season_id` integer NOT NULL,
	`category` text NOT NULL,
	`player_id` integer NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`season_id`, `category`, `player_id`),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `legacy` (
	`player_id` integer PRIMARY KEY NOT NULL,
	`json` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `season_archive` (
	`season_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`json` text NOT NULL,
	PRIMARY KEY(`season_id`, `player_id`),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `signal` (
	`season_id` integer PRIMARY KEY NOT NULL,
	`json` text NOT NULL,
	`lit_at` integer,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `signal_gifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`good` text NOT NULL,
	`amount` integer NOT NULL,
	`worth` integer NOT NULL,
	`at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `signal_gifts_season` ON `signal_gifts` (`season_id`,`player_id`);--> statement-breakpoint
ALTER TABLE `seasons` ADD `ends_at` integer;--> statement-breakpoint
ALTER TABLE `seasons` ADD `modifier` text;--> statement-breakpoint
ALTER TABLE `seasons` ADD `next_modifier` text;