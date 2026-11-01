ALTER TABLE `commands` ADD `expires_at` integer;--> statement-breakpoint
CREATE INDEX `commands_expires` ON `commands` (`expires_at`);