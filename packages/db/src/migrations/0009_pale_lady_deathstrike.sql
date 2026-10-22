CREATE TABLE `menu_item_location_inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_item_id` text NOT NULL,
	`pickup_location_id` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pickup_location_id`) REFERENCES `pickup_locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `menu_item_location_inventory_item_location_unique` ON `menu_item_location_inventory` (`menu_item_id`,`pickup_location_id`);--> statement-breakpoint
CREATE INDEX `menu_item_location_inventory_location_idx` ON `menu_item_location_inventory` (`pickup_location_id`);--> statement-breakpoint
ALTER TABLE `orders` ADD `inventory_location_id` text REFERENCES pickup_locations(id);--> statement-breakpoint
-- Backfill: split each item's existing global stock evenly across active
-- locations (floor division). The first active location by sort order takes
-- the remainder, so nothing is lost to rounding. Untracked items keep rows
-- too (quantity 0 is meaningless until tracking is enabled, but the rows make
-- every (item, location) pair exist from day one).
INSERT INTO `menu_item_location_inventory` (`id`, `menu_item_id`, `pickup_location_id`, `quantity`)
SELECT
	`m`.`id` || ':' || `l`.`id`,
	`m`.`id`,
	`l`.`id`,
	CASE
		WHEN `l`.`row_num` = 1
		THEN `m`.`inventory_quantity` - (`m`.`inventory_quantity` / `locs`.`n`) * (`locs`.`n` - 1)
		ELSE `m`.`inventory_quantity` / `locs`.`n`
	END
FROM `menu_items` `m`
JOIN (SELECT COUNT(*) AS `n` FROM `pickup_locations` WHERE `active` = 1) `locs` ON `locs`.`n` > 0
JOIN (
	SELECT `id`, ROW_NUMBER() OVER (ORDER BY `sort_order` ASC, `id` ASC) AS `row_num`
	FROM `pickup_locations`
	WHERE `active` = 1
) `l` ON `locs`.`n` >= `l`.`row_num`;