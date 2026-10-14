import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    /** Standard shipping weight per unit, in ounces. Used for rate quotes. */
    weightOunces: real("weight_ounces").notNull().default(0),
    /** Optional upper bound in ounces; quotes use this when set to never undercharge. */
    weightMaxOunces: real("weight_max_ounces"),
    /** Number of cookies in a pack; null for single items. Any size works (3/6/9/12/18/24...). */
    packSize: integer("pack_size"),
    /** Box/packaging weight added to a pack's computed weight, in ounces. */
    packTareOunces: real("pack_tare_ounces").notNull().default(0),
    /** Whether this item can be shipped. Cakes/shakes stay pickup-only. */
    isShippable: integer("is_shippable", { mode: "boolean" }).notNull().default(true),
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

/**
 * Fixed assortments: which cookies (and how many) go inside a pack menu item.
 * The pack itself is a normal menu item; its availability and shipping weight
 * derive from these contents.
 */
export const packContents = sqliteTable(
  "pack_contents",
  {
    id: text("id").primaryKey(),
    packItemId: text("pack_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    cookieItemId: text("cookie_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("pack_contents_pack_cookie_unique").on(table.packItemId, table.cookieItemId),
  ],
);

/**
 * Admin-editable shop configuration (shipping origin, handling fee, box
 * dimensions, saved rate-compare destinations). Values are JSON strings so
 * the shape can evolve without a migration per field.
 */
export const shopSettings = sqliteTable("shop_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

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

export const pickupLocations = sqliteTable(
  "pickup_locations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    address: text("address").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    phone: text("phone").notNull().default(""),
    /** Where order notifications for this location are routed. Falls back to admin emails when empty. */
    contactEmail: text("contact_email").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("pickup_locations_active_idx").on(table.active),
    index("pickup_locations_sort_idx").on(table.sortOrder),
  ],
);

export const pickupLocationsRelations = relations(pickupLocations, ({ many }) => ({
  orders: many(orders),
}));

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
    image: text("image"),
    stripeCustomerId: text("stripe_customer_id"),
    /** Access role: "admin" (full backoffice), "vendor" (future location-scoped), "customer" (default). */
    role: text("role"),
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
    /** "pickup" | "shipping" */
    fulfillmentType: text("fulfillment_type").notNull().default("pickup"),
    pickupDate: text("pickup_date").notNull(),
    pickupTime: text("pickup_time").notNull(),
    pickupLocationId: text("pickup_location_id").references(() => pickupLocations.id, {
      onDelete: "set null",
    }),
    pickupLocationName: text("pickup_location_name").notNull().default(""),
    // Shipping snapshot (authoritative at order time).
    shippingName: text("shipping_name").notNull().default(""),
    shippingLine1: text("shipping_line1").notNull().default(""),
    shippingLine2: text("shipping_line2").notNull().default(""),
    shippingCity: text("shipping_city").notNull().default(""),
    shippingState: text("shipping_state").notNull().default(""),
    shippingZip: text("shipping_zip").notNull().default(""),
    shippingCountry: text("shipping_country").notNull().default("US"),
    shippingServiceName: text("shipping_service_name").notNull().default(""),
    shippingCents: integer("shipping_cents").notNull().default(0),
    handlingCents: integer("handling_cents").notNull().default(0),
    /** subtotal + shipping + handling; what the customer is charged. */
    totalCents: integer("total_cents").notNull().default(0),
    shippoRateId: text("shippo_rate_id"),
    shippoShipmentId: text("shippo_shipment_id"),
    // Fulfilled by phase 3 (label purchase + tracking).
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    labelUrl: text("label_url"),
    shippoTransactionId: text("shippo_transaction_id"),
    shippingStatus: text("shipping_status").notNull().default(""),
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
    index("orders_pickup_location_idx").on(table.pickupLocationId),
    index("orders_fulfillment_idx").on(table.fulfillmentType),
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
    /**
     * JSON snapshot of the actual inventory reservations made for this line,
     * e.g. [{"menuItemId":"cookie-1","quantity":3}] after pack expansion.
     * Release paths use this so recipe edits after purchase can't mis-return
     * stock. Null for lines that reserved only their own row.
     */
    reservationSnapshot: text("reservation_snapshot"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const menuItemsRelations = relations(menuItems, ({ many }) => ({
  dailyMenuItems: many(dailyMenuItems),
  orderItems: many(orderItems),
  packContents: many(packContents, { relationName: "pack" }),
  insidePacks: many(packContents, { relationName: "cookie" }),
}));

export const packContentsRelations = relations(packContents, ({ one }) => ({
  packItem: one(menuItems, {
    fields: [packContents.packItemId],
    references: [menuItems.id],
    relationName: "pack",
  }),
  cookieItem: one(menuItems, {
    fields: [packContents.cookieItemId],
    references: [menuItems.id],
    relationName: "cookie",
  }),
}));

export const dailyMenuItemsRelations = relations(dailyMenuItems, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [dailyMenuItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  pickupLocation: one(pickupLocations, {
    fields: [orders.pickupLocationId],
    references: [pickupLocations.id],
  }),
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

/**
 * Fixed-window rate limit counters, keyed by `action:bucket-key` with the time
 * bucket baked into the key so stale rows are cheap to prune.
 */
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    bucketKey: text("bucket_key").primaryKey(),
    hits: integer("hits").notNull().default(0),
    /** Unix seconds when this bucket row is safe to delete. */
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("rate_limits_expires_idx").on(table.expiresAt)],
);
