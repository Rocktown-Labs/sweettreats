CREATE TABLE `pickup_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pickup_locations_active_idx` ON `pickup_locations` (`active`);--> statement-breakpoint
CREATE INDEX `pickup_locations_sort_idx` ON `pickup_locations` (`sort_order`);--> statement-breakpoint
ALTER TABLE `orders` ADD `pickup_location_id` text REFERENCES pickup_locations(id);--> statement-breakpoint
ALTER TABLE `orders` ADD `pickup_location_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `orders_pickup_location_idx` ON `orders` (`pickup_location_id`);