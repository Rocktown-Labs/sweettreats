CREATE TABLE `menu_items` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `category` text DEFAULT 'Cookies' NOT NULL,
  `description` text NOT NULL,
  `ingredients` text NOT NULL,
  `allergens` text DEFAULT '' NOT NULL,
  `price_cents` integer NOT NULL,
  `inventory_quantity` integer DEFAULT 0 NOT NULL,
  `track_inventory` integer DEFAULT false NOT NULL,
  `available` integer DEFAULT true NOT NULL,
  `featured` integer DEFAULT false NOT NULL,
  `image_key` text,
  `image_alt` text DEFAULT 'Sweet Treats LR cookie' NOT NULL,
  `stripe_product_id` text,
  `stripe_price_id` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `menu_items_slug_unique` ON `menu_items` (`slug`);
--> statement-breakpoint
CREATE INDEX `menu_items_available_idx` ON `menu_items` (`available`);
--> statement-breakpoint
CREATE INDEX `menu_items_featured_idx` ON `menu_items` (`featured`);
--> statement-breakpoint
CREATE TABLE `daily_menu_items` (
  `id` text PRIMARY KEY NOT NULL,
  `menu_item_id` text NOT NULL,
  `menu_date` text NOT NULL,
  `available_override` integer,
  `featured_override` integer,
  `note` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_menu_items_item_date_unique` ON `daily_menu_items` (`menu_item_id`,`menu_date`);
--> statement-breakpoint
CREATE INDEX `daily_menu_items_date_idx` ON `daily_menu_items` (`menu_date`);
--> statement-breakpoint
CREATE TABLE `orders` (
  `id` text PRIMARY KEY NOT NULL,
  `order_number` text NOT NULL,
  `clerk_user_id` text,
  `customer_name` text NOT NULL,
  `customer_email` text NOT NULL,
  `customer_phone` text NOT NULL,
  `pickup_date` text NOT NULL,
  `pickup_time` text NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `subtotal_cents` integer NOT NULL,
  `payment_status` text DEFAULT 'pay_on_pickup' NOT NULL,
  `checkout_provider` text DEFAULT 'manual' NOT NULL,
  `stripe_checkout_session_id` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);
--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`customer_email`);
--> statement-breakpoint
CREATE INDEX `orders_clerk_user_idx` ON `orders` (`clerk_user_id`);
--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);
--> statement-breakpoint
CREATE TABLE `order_items` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `menu_item_id` text,
  `item_name_snapshot` text NOT NULL,
  `item_description_snapshot` text NOT NULL,
  `unit_price_cents_snapshot` integer NOT NULL,
  `quantity` integer NOT NULL,
  `line_total_cents` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);
--> statement-breakpoint
INSERT INTO `menu_items` (`id`, `slug`, `name`, `category`, `description`, `ingredients`, `allergens`, `price_cents`, `inventory_quantity`, `track_inventory`, `available`, `featured`, `image_key`, `image_alt`, `sort_order`) VALUES
('cookie-brown-butter-chocolate-chip', 'brown-butter-chocolate-chip', 'Brown Butter Chocolate Chip', 'Main Cookies', 'A thick golden cookie with brown butter, chopped chocolate, and a soft middle.', 'Brown butter, flour, brown sugar, eggs, vanilla, chocolate chunks, sea salt', 'Contains wheat, milk, egg', 350, 24, 1, 1, 1, 'products/chocolate-chip-cookie.png', 'Brown butter chocolate chip cookie', 10),
('cookie-strawberry-crunch', 'strawberry-crunch', 'Strawberry Crunch', 'Main Cookies', 'Vanilla cookie packed with strawberry crumble and creamy white chocolate.', 'Flour, butter, sugar, eggs, strawberry crumble, white chocolate, vanilla', 'Contains wheat, milk, egg', 400, 18, 1, 1, 1, 'products/snickerdoodle-cookie.png', 'Strawberry crunch cookie', 20),
('cookie-lemon-glaze', 'lemon-glaze', 'Lemon Glaze', 'Main Cookies', 'Bright lemon cookie finished with a glossy vanilla lemon glaze.', 'Flour, butter, sugar, eggs, lemon zest, lemon juice, vanilla glaze', 'Contains wheat, milk, egg', 375, 16, 1, 1, 0, 'products/snickerdoodle-cookie.png', 'Lemon glaze cookie', 30),
('cookie-red-velvet', 'red-velvet-white-chip', 'Red Velvet White Chip', 'Main Cookies', 'Soft cocoa-red velvet cookie loaded with white chocolate chips.', 'Flour, butter, sugar, eggs, cocoa, white chocolate chips, vanilla', 'Contains wheat, milk, egg', 400, 20, 1, 1, 1, 'products/red-velvet-cookie.png', 'Red velvet white chip cookie', 40),
('cookie-oatmeal-cream', 'oatmeal-cream', 'Oatmeal Cream', 'Main Cookies', 'Brown sugar oatmeal cookie with cinnamon warmth and a vanilla cream drizzle.', 'Oats, flour, butter, brown sugar, eggs, cinnamon, vanilla cream', 'Contains wheat, milk, egg', 350, 0, 1, 0, 0, 'products/pecan-cookie.png', 'Oatmeal cream cookie', 50),
('cookie-birthday-confetti', 'birthday-confetti', 'Birthday Confetti', 'Main Cookies', 'Buttery birthday cookie with rainbow sprinkles and vanilla chips.', 'Flour, butter, sugar, eggs, vanilla chips, sprinkles, vanilla', 'Contains wheat, milk, egg', 375, 14, 1, 1, 0, 'products/chocolate-chip-cookie.png', 'Birthday confetti cookie', 60);
--> statement-breakpoint
INSERT INTO `daily_menu_items` (`id`, `menu_item_id`, `menu_date`, `available_override`, `featured_override`, `note`) VALUES
('daily-brown-butter-today', 'cookie-brown-butter-chocolate-chip', date('now'), 1, 1, 'Fresh batch today'),
('daily-strawberry-today', 'cookie-strawberry-crunch', date('now'), 1, 1, 'Limited quantity'),
('daily-red-velvet-today', 'cookie-red-velvet', date('now'), 1, 1, 'Fan favorite'),
('daily-lemon-today', 'cookie-lemon-glaze', date('now'), 1, 0, '');
