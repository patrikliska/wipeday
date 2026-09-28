CREATE TABLE `bases` (
	`player_id` integer NOT NULL,
	`season_id` integer NOT NULL,
	`state_json` text NOT NULL,
	`version` integer NOT NULL,
	`next_event_at` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `season_id`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bases_next_event` ON `bases` (`next_event_at`);--> statement-breakpoint
CREATE TABLE `commands` (
	`player_id` integer NOT NULL,
	`key` text NOT NULL,
	`result_json` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `key`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `commands_at` ON `commands` (`at`);--> statement-breakpoint
CREATE TABLE `event_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`player_id` integer,
	`season_id` integer,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_log_player_at` ON `event_log` (`player_id`,`at`);--> statement-breakpoint
CREATE INDEX `event_log_type_at` ON `event_log` (`type`,`at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_discord_id_unique` ON `players` (`discord_id`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`player_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_player` ON `sessions` (`player_id`);