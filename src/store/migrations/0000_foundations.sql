CREATE TABLE `app_emojis` (
	`name` text PRIMARY KEY NOT NULL,
	`emoji_id` text NOT NULL,
	`file_hash` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE `home_messages` (
	`player_id` integer PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_discord_id_unique` ON `players` (`discord_id`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
