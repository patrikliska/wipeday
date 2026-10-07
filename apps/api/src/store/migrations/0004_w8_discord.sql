CREATE TABLE `login_links` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`player_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `players` ADD `discord_dm` integer;