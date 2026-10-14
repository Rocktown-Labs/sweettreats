CREATE TABLE `pack_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`pack_item_id` text NOT NULL,
	`cookie_item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`pack_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cookie_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pack_contents_pack_cookie_unique` ON `pack_contents` (`pack_item_id`,`cookie_item_id`);--> statement-breakpoint
CREATE TABLE `shop_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `menu_items` ADD `weight_ounces` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `weight_max_ounces` real;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `pack_size` integer;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `pack_tare_ounces` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `is_shippable` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `reservation_snapshot` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfillment_type` text DEFAULT 'pickup' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_line1` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_line2` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_city` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_state` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_zip` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_country` text DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_service_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `handling_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `total_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shippo_rate_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `shippo_shipment_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_number` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_url` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `label_url` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `shippo_transaction_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `orders_fulfillment_idx` ON `orders` (`fulfillment_type`);