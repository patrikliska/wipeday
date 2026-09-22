CREATE TABLE `bases` (
	`player_id` integer PRIMARY KEY NOT NULL,
	`season_id` integer NOT NULL,
	`tier` text NOT NULL,
	`tool_id` text NOT NULL,
	`last_collected_at` integer NOT NULL,
	`last_gather_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hints` (
	`player_id` integer NOT NULL,
	`hint` text NOT NULL,
	`uses` integer NOT NULL,
	PRIMARY KEY(`player_id`, `hint`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`player_id` integer NOT NULL,
	`resource_id` text NOT NULL,
	`amount` integer NOT NULL,
	PRIMARY KEY(`player_id`, `resource_id`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
