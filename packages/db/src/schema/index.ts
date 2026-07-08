import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const orderStatuses = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const menuItems = sqliteTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Cookies"),
    description: text("description").notNull(),
    ingredients: text("ingredients").notNull(),
    allergens: text("allergens").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    inventoryQuantity: integer("inventory_quantity").notNull().default(0),
    trackInventory: integer("track_inventory", { mode: "boolean" }).notNull().default(false),
    available: integer("available", { mode: "boolean" }).notNull().default(true),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    imageKey: text("image_key"),
    imageAlt: text("image_alt").notNull().default("Sweet Treats LR cookie"),
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("menu_items_slug_unique").on(table.slug),
    index("menu_items_available_idx").on(table.available),
    index("menu_items_featured_idx").on(table.featured),
  ],
);

export const dailyMenuItems = sqliteTable(
  "daily_menu_items",
  {
    id: text("id").primaryKey(),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    menuDate: text("menu_date").notNull(),
    availableOverride: integer("available_override", { mode: "boolean" }),
    featuredOverride: integer("featured_override", { mode: "boolean" }),
    note: text("note").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("daily_menu_items_item_date_unique").on(table.menuItemId, table.menuDate),
    index("daily_menu_items_date_idx").on(table.menuDate),
  ],
);

export const shopDaySettings = sqliteTable(
  "shop_day_settings",
  {
    id: text("id").primaryKey(),
    dayDate: text("day_date").notNull(),
    closed: integer("closed", { mode: "boolean" }).notNull().default(false),
    note: text("note").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("shop_day_settings_date_unique").on(table.dayDate)],
);

export const shopDaySettingsRelations = relations(shopDaySettings, () => ({}));

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
    image: text("image"),
    stripeCustomerId: text("stripe_customer_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("session_token_unique").on(table.token)],
);

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    pickupDate: text("pickup_date").notNull(),
    pickupTime: text("pickup_time").notNull(),
    notes: text("notes").notNull().default(""),
    status: text("status", { enum: orderStatuses }).notNull().default("pending"),
    subtotalCents: integer("subtotal_cents").notNull(),
    paymentStatus: text("payment_status").notNull().default("pay_on_pickup"),
    checkoutProvider: text("checkout_provider").notNull().default("manual"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("orders_order_number_unique").on(table.orderNumber),
    index("orders_email_idx").on(table.customerEmail),
    index("orders_user_idx").on(table.userId),
    index("orders_status_idx").on(table.status),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id").references(() => menuItems.id, { onDelete: "set null" }),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    itemDescriptionSnapshot: text("item_description_snapshot").notNull(),
    unitPriceCentsSnapshot: integer("unit_price_cents_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const menuItemsRelations = relations(menuItems, ({ many }) => ({
  dailyMenuItems: many(dailyMenuItems),
  orderItems: many(orderItems),
}));

export const dailyMenuItemsRelations = relations(dailyMenuItems, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [dailyMenuItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));
