CREATE TABLE `api_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`last4` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
