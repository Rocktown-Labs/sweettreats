CREATE TABLE `cart_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text DEFAULT '' NOT NULL,
	`lines` text DEFAULT '[]' NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`abandoned_email_sent_at` text,
	`recovered_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `cart_snapshots_last_seen_idx` ON `cart_snapshots` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`available_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_outbox_status_idx` ON `email_outbox` (`status`,`available_at`);--> statement-breakpoint
CREATE INDEX `email_outbox_created_idx` ON `email_outbox` (`created_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `client_order_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_client_order_id_unique` ON `orders` (`client_order_id`);--> statement-breakpoint
CREATE INDEX `orders_created_idx` ON `orders` (`created_at`);