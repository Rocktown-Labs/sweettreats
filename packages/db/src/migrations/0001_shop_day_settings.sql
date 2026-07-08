CREATE TABLE `shop_day_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `day_date` text NOT NULL,
  `closed` integer DEFAULT false NOT NULL,
  `note` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_day_settings_date_unique` ON `shop_day_settings` (`day_date`);
