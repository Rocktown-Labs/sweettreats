CREATE TABLE `rate_limits` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`hits` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expires_idx` ON `rate_limits` (`expires_at`);--> statement-breakpoint
ALTER TABLE `pickup_locations` ADD `contact_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
-- Existing accounts predate email verification being enforced.
-- Mark them verified so password sign-in keeps working; new sign-ups
-- must verify via email. See PR notes: audit `SELECT email FROM user`
-- for squatted addresses before this runs.
UPDATE `user` SET `email_verified` = 1;
