CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`seller_id` integer NOT NULL,
	`local_id` text NOT NULL,
	`good` text NOT NULL,
	`amount` integer NOT NULL,
	`price` integer NOT NULL,
	`listed_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`buyer_id` integer,
	`closed_at` integer,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_seller_local` ON `listings` (`seller_id`,`season_id`,`local_id`);--> statement-breakpoint
CREATE INDEX `listings_status` ON `listings` (`season_id`,`status`);--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`good` text NOT NULL,
	`amount` integer NOT NULL,
	`price` integer NOT NULL,
	`at` integer NOT NULL,
	`seller_id` integer,
	`buyer_id` integer,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trades_good_at` ON `trades` (`season_id`,`good`,`at`);--> statement-breakpoint
CREATE TABLE `wheel_bets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round` integer NOT NULL,
	`player_id` integer NOT NULL,
	`segment` text NOT NULL,
	`amount` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wheel_bets_round` ON `wheel_bets` (`round`);