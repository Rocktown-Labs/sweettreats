import { createDb } from "@sweettreats/db";
import {
  dailyMenuItems,
  menuItems,
  orderItems,
  orders,
  orderStatuses,
  packContents as packContentsTable,
  pickupLocations,
  shopDaySettings,
  emailOutbox as emailOutboxTable,
  cartSnapshots as cartSnapshotsTable,
  user,
} from "@sweettreats/db/schema/index";
import { env } from "@sweettreats/env/server";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { currentUserEmail, requireAdmin } from "./auth-server";
import { createOrderToken, verifyOrderToken } from "./order-token";
import { releaseReservedLines } from "./inventory";
import { clientIpFromHeaders, rateLimit } from "./rate-limit";
import { PICKUP_WINDOW_DAYS, addDaysIso, isPickupSlotBookable, shopDateIso } from "./pickup";
import {
  derivePackStock,
  ensureShippingServiceGroup,
  getShippingSettings,
  loadPackContentsByPackIds,
  quoteShippingRates,
  resolveShippingOption,
  saveShippingSettings,
  shippoConfigured,
  type ShippingSettings,
} from "./shipping";
import {
  CHECKOUT_INTEGRATION_ID,
  currentStripeMode,
  getStripeClient,
  stripeClientFor,
} from "./stripe-client";
import { INTEGRATION_KEY_IDS, integrationKeyStatus, storeIntegrationKey } from "./secure-settings";
import { shippoClientFor } from "./shipping";
import { enqueueEmail, queueSend } from "./outbox";
import { logger } from "./logger";

/** Public base URL for links built for emails and Stripe redirects. */
function publicBaseUrl(): string {
  const fromEnv =
    (env as any).BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "https://sweettreatslr.com";
  return String(fromEnv).replace(/\/$/, "");
}

const cartLineSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().min(1).max(24),
});

const shippingAddressSchema = z.object({
  name: z.string().min(2, "Enter the recipient's name."),
  line1: z.string().min(3, "Enter a street address."),
  line2: z.string().max(200).optional().default(""),
  city: z.string().min(2, "Enter a city."),
  state: z.string().length(2, "Enter a 2-letter state."),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code."),
  country: z.literal("US").optional().default("US"),
});

const checkoutSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().regex(/^\+?[0-9()\-\s]{7,20}$/, "Enter a valid phone number."),
    notes: z.string().max(500).optional().default(""),
    items: z.array(cartLineSchema).min(1).max(50),
    /** Stable per-cart id from the browser; duplicate submits replay the same order. */
    clientOrderId: z.string().uuid().optional(),
    // Pickup details (required when not shipping)
    pickupLocationId: z.string().optional(),
    pickupDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid pickup date.")
      .optional(),
    pickupTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid pickup time.")
      .optional(),
    // Shipping details (required when not picking up)
    shipping: z
      .object({
        address: shippingAddressSchema,
        serviceTitle: z.string().min(2).max(120),
      })
      .optional(),
  })
  .refine(
    (data) =>
      Boolean(data.shipping) || (data.pickupLocationId && data.pickupDate && data.pickupTime),
    { message: "Choose pickup or shipping." },
  );

const shippingQuoteSchema = z.object({
  items: z.array(cartLineSchema).min(1).max(50),
  address: shippingAddressSchema,
});

const adminRatePreviewSchema = z.object({
  items: z.array(cartLineSchema).max(50).optional(),
  manualWeightOunces: z
    .number()
    .min(0.1)
    .max(70 * 16)
    .optional(),
  address: z.object({
    name: z.string().min(2),
    line1: z.string().min(3),
    line2: z.string().optional().default(""),
    city: z.string().min(2),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/),
    country: z.literal("US").optional().default("US"),
  }),
});

const pickupLocationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Location name is required"),
  address: z.string().min(3, "Address is required"),
  instructions: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  contactEmail: z
    .string()
    .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Enter a valid contact email or leave it blank.",
    })
    .optional()
    .default(""),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  slug: z.string().optional().default(""),
  category: z.string().min(2),
  description: z.string().min(8),
  ingredients: z.string().optional().default(""),
  allergens: z.string().optional().default(""),
  priceCents: z.number().int().min(1).max(100000),
  inventoryQuantity: z.number().int().min(0).default(0),
  trackInventory: z.boolean().default(false),
  available: z.boolean(),
  featured: z.boolean(),
  imageKey: z.string().optional().nullable(),
  imageAlt: z.string().optional().default("Sweet Treats LR cookie"),
  stripeProductId: z.string().optional().nullable(),
  stripePriceId: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  weightOunces: z
    .number()
    .min(0)
    .max(70 * 16)
    .default(0),
  weightMaxOunces: z
    .number()
    .min(0)
    .max(70 * 16)
    .optional()
    .nullable(),
  isShippable: z.boolean().default(true),
  /** When set, this item is a pack/box of `packSize` cookies. */
  packSize: z.number().int().min(1).max(48).optional().nullable(),
  packTareOunces: z
    .number()
    .min(0)
    .max(70 * 16)
    .default(0),
  /** Fixed assortment contents: [{ cookieItemId, quantity }]. Sum should equal packSize. */
  packContents: z
    .array(
      z.object({
        cookieItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(48),
      }),
    )
    .max(24)
    .optional(),
});

const uploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(3),
  base64: z.string().min(1),
});

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const dailyMenuSchema = z.object({
  menuItemId: z.string().min(1),
  menuDate: z.string().min(10),
  availableOverride: z.boolean().nullable(),
  featuredOverride: z.boolean().nullable(),
  note: z.string().optional().default(""),
});

const weeklyMenuSchema = z.object({
  weekStart: z.string().min(10),
  itemDays: z.record(z.string(), z.array(z.string().min(10))).default({}),
  closedDates: z.array(z.string().min(10)).default([]),
});

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type MenuDaySettings = typeof shopDaySettings.$inferSelect;
type MenuItemRow = typeof menuItems.$inferSelect;
type DailyMenuRow = typeof dailyMenuItems.$inferSelect;

/**
 * Resolve the first bookable menu on or after `startDate`, within the next
 * `limit` days. Fetched with a bounded range query (3 queries total) instead
 * of a per-day query loop, so home/menu/checkout loads stay fast.
 */
async function nextAvailableMenu(db: ReturnType<typeof createDb>, startDate = shopDateIso()) {
  const limit = 21;
  const endDate = addDaysIso(startDate, limit);

  const [daySettings, itemRows, dailyRows] = await Promise.all([
    db
      .select()
      .from(shopDaySettings)
      .where(and(gte(shopDaySettings.dayDate, startDate), lte(shopDaySettings.dayDate, endDate))),
    db.select().from(menuItems).orderBy(asc(menuItems.sortOrder), asc(menuItems.name)),
    db
      .select()
      .from(dailyMenuItems)
      .where(and(gte(dailyMenuItems.menuDate, startDate), lte(dailyMenuItems.menuDate, endDate))),
  ]);

  const closedByDate = new Map<string, MenuDaySettings>();
  for (const day of daySettings) {
    closedByDate.set(day.dayDate, day);
  }
  const dailyByItemDate = new Map<string, DailyMenuRow>();
  for (const daily of dailyRows) {
    dailyByItemDate.set(`${daily.menuItemId}:${daily.menuDate}`, daily);
  }

  // Pack contents for availability derivation (single extra query when packs exist).
  const packIds = itemRows.filter((item) => item.packSize).map((item) => item.id);
  const contentsByPackId = await loadPackContentsByPackIds(db, packIds);

  const decorate = (menuDate: string) => {
    const base = itemRows.map((item: MenuItemRow) => {
      const daily = dailyByItemDate.get(`${item.id}:${menuDate}`);
      const rowAvailable = daily?.availableOverride ?? item.available;
      return {
        ...item,
        todayNote: daily?.note ?? "",
        rowAvailable,
        available: rowAvailable && (!item.trackInventory || item.inventoryQuantity > 0),
        featured: daily?.featuredOverride ?? item.featured,
        dailyMenuId: daily?.id ?? null,
      };
    });

    // Packs with contents derive their entire stock projection (availability
    // AND the sellable count) from the cookies inside them via derivePackStock
    // — the same helper getMenu and order-time checks use, so the homepage
    // card, menu page, and checkout all agree. The pack row's own inventory
    // flags never apply to content packs. Daily menu overrides on a cookie
    // (e.g. "sold out today only") propagate into the pack for this date.
    const derived = base.map((item) => {
      if (!item.packSize) {
        return item;
      }
      const contents = contentsByPackId.get(item.id) ?? [];
      if (contents.length === 0) {
        return item;
      }
      const dateAwareContents = contents.map((content) => {
        if (!content.cookie) {
          return content;
        }
        // availableOverride is null when there's no override for the date,
        // in which case the cookie's own flag stands.
        const override = dailyByItemDate.get(
          `${content.cookieItemId}:${menuDate}`,
        )?.availableOverride;
        return {
          ...content,
          cookie: { ...content.cookie, available: override ?? content.cookie.available },
        };
      });
      const stock = derivePackStock({ ...item, available: item.rowAvailable }, dateAwareContents);
      return {
        ...item,
        available: stock.available,
        trackInventory: stock.trackInventory,
        inventoryQuantity: stock.inventoryQuantity,
      };
    });

    return derived
      .filter((item) => item.available || item.featured)
      .map(({ rowAvailable: _rowAvailable, ...item }) => item)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  };

  for (let offset = 0; offset < limit; offset += 1) {
    const date = addDaysIso(startDate, offset);
    const day = closedByDate.get(date);
    if (day?.closed) {
      continue;
    }
    const items = decorate(date);
    if (items.some((item) => item.available)) {
      return { menuDate: date, closed: false, closedNote: day?.note ?? "", items };
    }
  }

  return {
    menuDate: startDate,
    closed: false,
    closedNote: closedByDate.get(startDate)?.note ?? "",
    items: decorate(startDate),
  };
}

const seedMenu = [
  {
    id: "cookie-brown-butter-chocolate-chip",
    slug: "brown-butter-chocolate-chip",
    name: "Brown Butter Chocolate Chip",
    category: "Main Cookies",
    description: "A thick golden cookie with brown butter, chopped chocolate, and a soft middle.",
    ingredients: "Brown butter, flour, brown sugar, eggs, vanilla, chocolate chunks, sea salt",
    allergens: "Contains wheat, milk, egg",
    priceCents: 350,
    inventoryQuantity: 24,
    trackInventory: true,
    available: true,
    featured: true,
    imageKey: "products/chocolate-chip-cookie.png",
    imageAlt: "Brown butter chocolate chip cookie",
    stripeProductId: null,
    stripePriceId: null,
    sortOrder: 10,
    weightOunces: 0,
    weightMaxOunces: null,
    packSize: null,
    packTareOunces: 0,
    isShippable: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "cookie-strawberry-crunch",
    slug: "strawberry-crunch",
    name: "Strawberry Crunch",
    category: "Main Cookies",
    description: "Vanilla cookie packed with strawberry crumble and creamy white chocolate.",
    ingredients: "Flour, butter, sugar, eggs, strawberry crumble, white chocolate, vanilla",
    allergens: "Contains wheat, milk, egg",
    priceCents: 400,
    inventoryQuantity: 18,
    trackInventory: true,
    available: true,
    featured: true,
    imageKey: "products/snickerdoodle-cookie.png",
    imageAlt: "Strawberry crunch cookie",
    stripeProductId: null,
    stripePriceId: null,
    sortOrder: 20,
    weightOunces: 0,
    weightMaxOunces: null,
    packSize: null,
    packTareOunces: 0,
    isShippable: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "cookie-red-velvet",
    slug: "red-velvet-white-chip",
    name: "Red Velvet White Chip",
    category: "Main Cookies",
    description: "Soft cocoa-red velvet cookie loaded with white chocolate chips.",
    ingredients: "Flour, butter, sugar, eggs, cocoa, white chocolate chips, vanilla",
    allergens: "Contains wheat, milk, egg",
    priceCents: 400,
    inventoryQuantity: 20,
    trackInventory: true,
    available: true,
    featured: true,
    imageKey: "products/red-velvet-cookie.png",
    imageAlt: "Red velvet white chip cookie",
    stripeProductId: null,
    stripePriceId: null,
    sortOrder: 40,
    weightOunces: 0,
    weightMaxOunces: null,
    packSize: null,
    packTareOunces: 0,
    isShippable: true,
    createdAt: "",
    updatedAt: "",
  },
] satisfies (typeof menuItems.$inferSelect)[];

export type PickupLocation = typeof pickupLocations.$inferSelect;

export const seedPickupLocations: PickupLocation[] = [
  {
    id: "loc-downtown",
    name: "Little Rock Pickup (LR)",
    address: "Downtown Little Rock (River Market area), Little Rock, AR",
    instructions: "Pick up at the front counter. Curbside pickup available upon request.",
    phone: "(501) 555-0142",
    contactEmail: "",
    active: true,
    sortOrder: 0,
    createdAt: "2026-07-01 00:00:00",
    updatedAt: "2026-07-01 00:00:00",
  },
  {
    id: "loc-west-lr",
    name: "North Little Rock Pickup (NLR)",
    address: "North Little Rock (Argenta / Main St District), North Little Rock, AR",
    instructions: "Partner pickup desk. State your name and Sweet Treats order number.",
    phone: "(501) 555-0188",
    contactEmail: "",
    active: true,
    sortOrder: 1,
    createdAt: "2026-07-01 00:00:00",
    updatedAt: "2026-07-01 00:00:00",
  },
];

async function getOrCreatePickupLocations(db: ReturnType<typeof createDb>) {
  try {
    const existing = await db
      .select()
      .from(pickupLocations)
      .orderBy(asc(pickupLocations.sortOrder), asc(pickupLocations.name));

    if (existing.length === 0) {
      // First run on a fresh database: seed the defaults once. After this,
      // reads never write; renames/data fixes belong in SQL migrations.
      try {
        await db.insert(pickupLocations).values(seedPickupLocations);
      } catch {
        // A concurrent first request may have seeded already; fall through.
      }
      return seedPickupLocations;
    }

    return existing;
  } catch {
    return seedPickupLocations;
  }
}

function hasDatabase() {
  return !!env.DB;
}

function dbRequired() {
  if (!hasDatabase()) {
    throw new Error("Cloudflare D1 binding is not available. Run through Alchemy/Cloudflare dev.");
  }

  return createDb();
}

export const getMenu = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) {
    return seedMenu.map(publicMenuItem);
  }

  const db = createDb();
  const items = await db
    .select()
    .from(menuItems)
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name));

  // Packs derive availability from their contents.
  const contentsByPackId = await loadPackContentsByPackIds(
    db,
    items.filter((item) => item.packSize).map((item) => item.id),
  );

  return items.map((item) => {
    let available = item.available && (!item.trackInventory || item.inventoryQuantity > 0);
    let trackInventory = item.trackInventory;
    let inventoryQuantity = item.inventoryQuantity;
    if (item.packSize) {
      const contents = contentsByPackId.get(item.id) ?? [];
      if (contents.length > 0) {
        // Populated packs ignore the pack row's own inventory: availability
        // and the sellable count come from the cookies inside (the row is
        // never decremented for content packs).
        const stock = derivePackStock(item, contents);
        available = stock.available;
        trackInventory = stock.trackInventory;
        inventoryQuantity = stock.inventoryQuantity;
      }
      // Content-less packs keep row-based semantics.
    }
    return publicMenuItem({ ...item, available, trackInventory, inventoryQuantity });
  });
});

/**
 * Public projection for the storefront: internal Stripe ids never leave the
 * server. Inventory fields stay — the low-stock badge and quantity caps
 * depend on them. Pack/shipping flags drive the checkout UI.
 */
function publicMenuItem(item: typeof menuItems.$inferSelect & { available?: boolean }) {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    category: item.category,
    description: item.description,
    ingredients: item.ingredients,
    allergens: item.allergens,
    priceCents: item.priceCents,
    trackInventory: item.trackInventory,
    inventoryQuantity: item.inventoryQuantity,
    available: item.available ?? true,
    featured: item.featured,
    imageKey: item.imageKey,
    imageAlt: item.imageAlt,
    sortOrder: item.sortOrder,
    packSize: item.packSize,
    isShippable: item.isShippable,
  };
}

/** Strip internal Stripe ids from an item before returning it to the public. */
function stripStripeIds<T extends Record<string, unknown>>(
  item: T,
): Omit<T, "stripeProductId" | "stripePriceId"> {
  const { stripeProductId: _drop1, stripePriceId: _drop2, ...rest } = item;
  return rest as Omit<T, "stripeProductId" | "stripePriceId">;
}

export const getTodayMenu = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) {
    return {
      menuDate: shopDateIso(),
      requestedDate: shopDateIso(),
      closed: false,
      closedNote: "",
      items: seedMenu.map((item) => ({
        ...stripStripeIds(item),
        todayNote: "",
        dailyMenuId: null,
      })),
    };
  }

  const db = createDb();
  const today = shopDateIso();
  const menu = await nextAvailableMenu(db, today);
  return {
    ...menu,
    requestedDate: today,
    items: menu.items.map((item) => stripStripeIds(item)),
  };
});

export const getPickupAvailability = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) {
    return {
      pickupDate: shopDateIso(),
      closed: false,
      locations: seedPickupLocations.filter((l) => l.active),
    };
  }

  const db = createDb();
  const [menu, allLocations] = await Promise.all([
    nextAvailableMenu(db),
    getOrCreatePickupLocations(db),
  ]);

  return {
    pickupDate: menu.menuDate,
    closed: menu.closed,
    locations: allLocations.filter((l) => l.active),
  };
});

export const getPickupLocations = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) {
    return seedPickupLocations.filter((l) => l.active);
  }
  const db = createDb();
  const all = await getOrCreatePickupLocations(db);
  return all.filter((l) => l.active);
});

export const getAdminPickupLocations = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  if (!hasDatabase()) {
    return seedPickupLocations;
  }
  const db = dbRequired();
  return getOrCreatePickupLocations(db);
});

export const savePickupLocation = createServerFn({ method: "POST" })
  .validator((data: unknown) => pickupLocationSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    if (!hasDatabase()) {
      return { id: data.id || "mock-loc-id", ...data };
    }
    const db = dbRequired();
    const id = data.id || crypto.randomUUID();
    const values = {
      name: data.name,
      address: data.address,
      instructions: data.instructions,
      phone: data.phone,
      contactEmail: data.contactEmail,
      active: data.active,
      sortOrder: data.sortOrder,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };

    if (data.id) {
      await db.update(pickupLocations).set(values).where(eq(pickupLocations.id, data.id));
      logger.info("admin.pickup_location_updated", { id, name: data.name });
    } else {
      await db.insert(pickupLocations).values({ id, ...values });
      logger.info("admin.pickup_location_created", { id, name: data.name });
    }

    return { id, ...values };
  });

export const deletePickupLocation = createServerFn({ method: "POST" })
  .validator((id: string) => z.string().min(1).parse(id))
  .handler(async ({ data: id }) => {
    await requireAdmin();
    if (!hasDatabase()) {
      return { ok: true };
    }
    const db = dbRequired();
    await db.delete(pickupLocations).where(eq(pickupLocations.id, id));
    logger.info("admin.pickup_location_deleted", { id });
    return { ok: true };
  });

export const getMenuItem = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    if (!hasDatabase()) {
      return seedMenu.find((item) => item.id === id) ?? null;
    }

    const db = createDb();
    const item = await db.query.menuItems.findFirst({
      where: eq(menuItems.id, id),
    });
    if (!item) {
      return null;
    }

    // Packs project derived stock so the detail page's low-stock badge and
    // quantity cap match what checkout will actually allow.
    let projected = item;
    if (item.packSize) {
      const contents = await loadPackContentsByPackIds(db, [item.id]);
      const rows = contents.get(item.id) ?? [];
      if (rows.length > 0) {
        const stock = derivePackStock(item, rows);
        projected = {
          ...item,
          available: stock.available,
          trackInventory: stock.trackInventory,
          inventoryQuantity: stock.inventoryQuantity,
        };
      }
    }

    // Public item page: strip internal Stripe ids, keep the rest.
    return stripStripeIds(projected);
  });

export const getAdminMenuItem = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin();
    if (id === "new") {
      return null;
    }

    if (!hasDatabase()) {
      return seedMenu.find((item) => item.id === id) ?? null;
    }

    const item = await dbRequired().query.menuItems.findFirst({
      where: eq(menuItems.id, id),
    });
    if (!item) {
      return null;
    }

    const contents = await loadPackContentsByPackIds(createDb(), [item.id]);
    return {
      ...item,
      packContents: (contents.get(item.id) ?? []).map((content) => ({
        cookieItemId: content.cookieItemId,
        quantity: content.quantity,
      })),
    };
  });

/**
 * Idempotent replay support: an order created earlier with the same stable
 * cart id is returned as-is. The order token is a deterministic HMAC of the
 * order id, so the success URL can be rebuilt exactly.
 */
async function replayExistingOrder(db: ReturnType<typeof createDb>, clientOrderId: string) {
  const existing = await db.query.orders.findFirst({
    where: eq(orders.clientOrderId, clientOrderId),
    columns: {
      id: true,
      orderNumber: true,
      checkoutProvider: true,
      stripeCheckoutSessionId: true,
      status: true,
      paymentStatus: true,
    },
  });
  if (!existing) {
    return null;
  }
  const orderToken = await createOrderToken(existing.id);
  // Rebuild the same result shape createOrder returns, with a fresh Stripe
  // URL only when the original session is still alive and unpaid.
  let checkoutUrl: string | null = null;
  const stripe = await getStripeClient();
  if (stripe && existing.stripeCheckoutSessionId && existing.paymentStatus !== "paid") {
    try {
      const session = await stripe.checkout.sessions.retrieve(existing.stripeCheckoutSessionId);
      checkoutUrl = session.url ?? null;
    } catch {
      checkoutUrl = null;
    }
  }
  return { orderId: existing.id, orderNumber: existing.orderNumber, checkoutUrl, orderToken };
}

export const createOrder = createServerFn({ method: "POST" })
  .validator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }) => {
    const db = dbRequired();

    // Rate limit by client IP: order creation writes to D1, syncs Stripe and
    // triggers notification emails, so it must not be spammable.
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const ip = clientIpFromHeaders(getRequestHeaders());
    const limit = await rateLimit(db, "create-order", ip, 10 * 60, 6);
    if (!limit.ok) {
      throw new Error("Too many orders sent from this connection. Try again in a few minutes.");
    }

    // Idempotent replay: a retry with the same stable cart id returns the
    // original order instead of creating (and charging inventory for) a
    // second one.
    if (data.clientOrderId) {
      const existing = await replayExistingOrder(db, data.clientOrderId);
      if (existing) {
        logger.info("order.idempotent_replay", { orderId: existing.orderId });
        return existing;
      }
    }

    // Fulfillment branch: pickup orders validate the slot server-side; shipping
    // orders resolve the carrier price fresh from Shippo (the browser only
    // ever submits the service title, never an amount).
    const isShipping = Boolean(data.shipping);
    let pickupDate = "";
    let pickupTime = "";
    if (!isShipping) {
      const today = shopDateIso();
      const maxDate = addDaysIso(today, PICKUP_WINDOW_DAYS);
      if (!data.pickupDate || data.pickupDate < today || data.pickupDate > maxDate) {
        throw new Error("Choose a pickup date within the next 30 days.");
      }
      if (!data.pickupTime || !isPickupSlotBookable(data.pickupDate, data.pickupTime)) {
        throw new Error("That pickup time is not available. Pick another slot.");
      }
    }

    const ids = data.items.map((item) => item.id);
    const foundItems = await db.select().from(menuItems).where(inArray(menuItems.id, ids));
    const byId = new Map(foundItems.map((item) => [item.id, item]));

    // Packs derive availability from their contents.
    const packIds = foundItems.filter((item) => item.packSize).map((item) => item.id);
    const contentsByPackId = await loadPackContentsByPackIds(db, packIds);
    // Content cookies aren't cart lines; keep their names reachable for
    // accurate sold-out errors during reservation.
    const nameByContentId = new Map<string, string>();
    for (const contents of contentsByPackId.values()) {
      for (const content of contents) {
        if (content.cookie) {
          nameByContentId.set(content.cookieItemId, content.cookie.name);
        }
      }
    }
    const isLineSellable = (item: (typeof foundItems)[number], quantity: number) => {
      if (!item.available) {
        return false;
      }
      if (item.packSize) {
        const contents = contentsByPackId.get(item.id) ?? [];
        // Packs with contents derive stock from the cookies inside them;
        // the pack row's own inventory flags never apply. (byId only holds
        // cart line ids, so resolve via content.cookie.)
        if (contents.length > 0) {
          const stock = derivePackStock(item, contents);
          return stock.available && (!stock.trackInventory || stock.inventoryQuantity >= quantity);
        }
        // Content-less packs (manual weight) sell from their own row.
        return !item.trackInventory || item.inventoryQuantity >= quantity;
      }
      return !item.trackInventory || item.inventoryQuantity >= quantity;
    };

    const lines = data.items.map((line) => {
      const item = byId.get(line.id);
      if (!item || !isLineSellable(item, line.quantity)) {
        throw new Error("One or more cookies are no longer available.");
      }

      return {
        item,
        quantity: line.quantity,
        lineTotalCents: item.priceCents * line.quantity,
      };
    });

    // Shipping: authoritative price resolution happens before anything is
    // reserved or persisted, so failures cost nothing.
    let shippingCents = 0;
    let handlingCents = 0;
    let shippingServiceName = "";
    if (data.shipping) {
      const settings = await getShippingSettings();
      const resolved = await resolveShippingOption(
        {
          lines,
          addressTo: {
            name: data.shipping.address.name,
            line1: data.shipping.address.line1,
            line2: data.shipping.address.line2,
            city: data.shipping.address.city,
            state: data.shipping.address.state,
            zip: data.shipping.address.zip,
            country: data.shipping.address.country,
          },
        },
        data.shipping.serviceTitle,
      );
      shippingServiceName = resolved.serviceName;
      shippingCents = resolved.shippingCents;
      handlingCents = settings.handlingFeeCents;
    }

    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const { userId } = await currentUserEmail();
    // Attach the payment to the shop's Stripe Customer when we know one
    // (better-auth creates it on signup via the stripe plugin).
    let stripeCustomerId: string | null = null;
    if (userId) {
      const account = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { stripeCustomerId: true },
      });
      stripeCustomerId = account?.stripeCustomerId ?? null;
    }
    const orderId = crypto.randomUUID();
    // Timestamp keeps numbers human-sortable; random suffix prevents collisions
    // when two orders land in the same millisecond (unique index would reject).
    const orderNumber = `ST-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    // Set once the order rows are durably written, so the failure path knows
    // whether to cancel the persisted order (see the catch below).
    let orderPersisted = false;
    if (!isShipping) {
      const pickupMenu = await nextAvailableMenu(db, data.pickupDate ?? shopDateIso());
      pickupDate = pickupMenu.menuDate;
      pickupTime = data.pickupTime ?? "";
    }

    // Reservation units, aggregated per line (packs expand into their
    // cookies, and two packs can share a cookie). Each line's snapshot of
    // its own contribution is stored on order_items so releases stay correct
    // even if the pack recipe is edited later.
    const lineSnapshots: (string | null)[] = [];
    const reservedLines: { itemId: string; quantity: number }[] = [];
    try {
      for (const line of lines) {
        const units = new Map<string, number>();
        if (line.item.packSize) {
          const contents = contentsByPackId.get(line.item.id) ?? [];
          for (const content of contents) {
            // byId only holds cart line ids; the loaded content.cookie is
            // the authoritative row for the pack's cookies.
            if (content.cookie?.trackInventory) {
              units.set(
                content.cookieItemId,
                (units.get(content.cookieItemId) ?? 0) + content.quantity * line.quantity,
              );
            }
          }
          if (contents.length === 0 && line.item.trackInventory) {
            // Content-less pack (manual weight): reserve the pack row itself.
            units.set(line.item.id, line.quantity);
          }
        } else if (line.item.trackInventory) {
          units.set(line.item.id, line.quantity);
        }

        if (units.size === 0) {
          lineSnapshots.push(null);
          continue;
        }

        for (const [itemId, quantity] of units) {
          const reserved = await db
            .update(menuItems)
            .set({
              inventoryQuantity: sql`${menuItems.inventoryQuantity} - ${quantity}`,
              available: sql`CASE WHEN ${menuItems.inventoryQuantity} - ${quantity} > 0 THEN 1 ELSE 0 END`,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(
              and(
                eq(menuItems.id, itemId),
                eq(menuItems.available, true),
                gte(menuItems.inventoryQuantity, quantity),
              ),
            )
            .returning({ id: menuItems.id });

          if (reserved.length === 0) {
            // Content cookies aren't cart lines, so look names up in the
            // contents map too — a pack's cookie selling out mid-order should
            // say which one, not "An item".
            const soldOutName = byId.get(itemId)?.name ?? nameByContentId.get(itemId) ?? "An item";
            throw new Error(`${soldOutName} just sold out or does not have enough left.`);
          }

          reservedLines.push({ itemId, quantity });
        }
        lineSnapshots.push(
          units.size > 0
            ? JSON.stringify(
                [...units.entries()].map(([itemId, quantity]) => ({
                  menuItemId: itemId,
                  quantity,
                })),
              )
            : null,
        );
      }
    } catch (caught) {
      // Mid-loop failure: earlier iterations already reserved stock — give
      // it back before surfacing the error so nothing leaks.
      await releaseReservedLines(db, reservedLines).catch(() => {});
      throw caught;
    }

    let pickupLocationName = "Bakery Pickup";
    let pickupLocationId: string | null = null;
    if (!isShipping && data.pickupLocationId) {
      pickupLocationId = data.pickupLocationId;
      const loc = await db.query.pickupLocations
        .findFirst({
          where: eq(pickupLocations.id, data.pickupLocationId),
        })
        .catch(() => null);
      pickupLocationName =
        loc?.name ??
        seedPickupLocations.find((l) => l.id === data.pickupLocationId)?.name ??
        pickupLocationName;
    }
    if (isShipping) {
      pickupLocationName = "Shipped";
    }

    try {
      // 1. Persist the order FIRST so a paid Stripe session can never point at
      //    an order that failed to insert. order + items go in one atomic batch.
      const totalCents = subtotalCents + shippingCents + handlingCents;
      const orderValues = {
        id: orderId,
        orderNumber,
        userId,
        customerName: data.name,
        customerEmail: data.email,
        customerPhone: data.phone,
        clientOrderId: data.clientOrderId ?? null,
        fulfillmentType: isShipping ? ("shipping" as const) : ("pickup" as const),
        pickupLocationId,
        pickupLocationName,
        pickupDate,
        pickupTime,
        shippingName: data.shipping?.address.name ?? "",
        shippingLine1: data.shipping?.address.line1 ?? "",
        shippingLine2: data.shipping?.address.line2 ?? "",
        shippingCity: data.shipping?.address.city ?? "",
        shippingState: data.shipping?.address.state ?? "",
        shippingZip: data.shipping?.address.zip ?? "",
        shippingCountry: data.shipping?.address.country ?? "US",
        shippingServiceName,
        shippingCents,
        handlingCents,
        totalCents,
        notes: data.notes,
        status: "pending" as const,
        subtotalCents,
      };

      const orderItemsValues = lines.map((line, index) => ({
        id: crypto.randomUUID(),
        orderId,
        menuItemId: line.item.id,
        itemNameSnapshot: line.item.name,
        itemDescriptionSnapshot: line.item.description,
        unitPriceCentsSnapshot: line.item.priceCents,
        quantity: line.quantity,
        lineTotalCents: line.lineTotalCents,
        reservationSnapshot: lineSnapshots[index] ?? null,
      }));

      // The outbox row for pay-on-pickup confirmation travels in the SAME
      // atomic batch as the order — a crash between insert and send can
      // never lose the email intent. The Stripe path enqueues its outbox
      // row from the webhook (or the session-failure fallback) instead.
      const stripeWillBeUsed = (await getStripeClient()) !== null;
      const outboxId = crypto.randomUUID();
      const enqueueConfirmation = !stripeWillBeUsed;
      const outboxValues = {
        id: outboxId,
        event: "order.confirmed",
        payload: JSON.stringify({ orderId }),
      };

      await db.batch([
        db.insert(orders).values(orderValues),
        db.insert(orderItems).values(orderItemsValues),
        ...(enqueueConfirmation ? [db.insert(emailOutboxTable).values(outboxValues)] : []),
      ]);
      orderPersisted = true;

      // Recovering this cart (if tracked) marks it won-back for the admin
      // view and suppresses any pending abandonment email.
      if (data.clientOrderId) {
        await db
          .update(cartSnapshotsTable)
          .set({ recoveredAt: sql`CURRENT_TIMESTAMP`, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(cartSnapshotsTable.id, data.clientOrderId))
          .catch(() => {});
      }
      if (enqueueConfirmation) {
        await queueSend({ outboxId }).catch(() => {});
      }

      // 2. Build the Stripe session against the persisted order.
      const baseUrl = publicBaseUrl();
      const orderToken = await createOrderToken(orderId);
      const successUrl = `${baseUrl}/order/success?orderId=${orderId}&t=${orderToken}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/checkout`;

      const stripe = await getStripeClient();
      let checkoutUrl: string | null = null;
      let stripeCheckoutSessionId: string | null = null;

      if (stripe) {
        try {
          // Ensure all line items are synced to Stripe
          for (const line of lines) {
            if (!line.item.stripePriceId) {
              try {
                let prodId = line.item.stripeProductId;
                if (!prodId) {
                  const prod = await stripe.products.create({
                    name: line.item.name,
                    description: line.item.description || undefined,
                  });
                  prodId = prod.id;
                }
                const pr = await stripe.prices.create({
                  product: prodId,
                  unit_amount: line.item.priceCents,
                  currency: "usd",
                });
                line.item.stripeProductId = prodId;
                line.item.stripePriceId = pr.id;
                await db
                  .update(menuItems)
                  .set({
                    stripeProductId: prodId,
                    stripePriceId: pr.id,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                  })
                  .where(eq(menuItems.id, line.item.id));
              } catch (err) {
                logger.warn("stripe.item_auto_sync_fallback", {
                  itemId: line.item.id,
                  error: String(err),
                });
              }
            }
          }

          const session = await stripe.checkout.sessions.create({
            // No payment_method_types: dynamic payment methods let Stripe
            // surface the most relevant eligible methods per customer.
            line_items: [
              ...lines.map((line) => {
                if (line.item.stripePriceId) {
                  return {
                    price: line.item.stripePriceId,
                    quantity: line.quantity,
                  };
                }
                return {
                  price_data: {
                    currency: "usd",
                    product_data: {
                      name: line.item.name,
                      description: line.item.description || undefined,
                    },
                    unit_amount: line.item.priceCents,
                  },
                  quantity: line.quantity,
                };
              }),
              ...(shippingCents + handlingCents > 0
                ? [
                    {
                      price_data: {
                        currency: "usd",
                        product_data: {
                          name: `Shipping${shippingServiceName ? ` — ${shippingServiceName}` : ""} (includes handling)`,
                        },
                        unit_amount: shippingCents + handlingCents,
                      },
                      quantity: 1,
                    },
                  ]
                : []),
            ],
            mode: "payment",
            success_url: successUrl,
            cancel_url: cancelUrl,
            // Abandoned sessions expire quickly so reserved inventory is
            // released by the checkout.session.expired webhook.
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
            // Attach the payment to the shop's Stripe Customer when we know
            // one (better-auth creates it on signup), else fall back to the
            // email the customer typed.
            ...(stripeCustomerId
              ? { customer: stripeCustomerId }
              : { customer_email: data.email || undefined }),
            // Discount codes: admins create promotion codes in the Stripe
            // Dashboard and customers apply them at checkout — no custom
            // code needed.
            allow_promotion_codes: true,
            integration_identifier: CHECKOUT_INTEGRATION_ID,
            metadata: {
              orderId,
              orderNumber,
            },
          });
          checkoutUrl = session.url;
          stripeCheckoutSessionId = session.id;
        } catch (err) {
          logger.error("stripe.checkout_failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (checkoutUrl && stripeCheckoutSessionId) {
        try {
          await db
            .update(orders)
            .set({ stripeCheckoutSessionId, updatedAt: sql`CURRENT_TIMESTAMP` })
            .where(eq(orders.id, orderId));
        } catch (err) {
          // Transient write failure: the success URL carries an order token
          // and the webhook resolves by metadata, so the flow still works.
          logger.warn("stripe.session_id_update_failed", {
            orderId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        // No Stripe (unconfigured or session creation failed): treat as
        // pay-on-pickup so the order is never stranded in pending, and
        // enqueue the confirmation email the batch skipped.
        await db
          .update(orders)
          .set({
            status: "confirmed",
            paymentStatus: "pay_on_pickup",
            checkoutProvider: "manual",
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(orders.id, orderId));
        if (!enqueueConfirmation) {
          // The batch skipped this row because we expected a Stripe session;
          // the fallback confirmation still needs its email.
          await enqueueEmail(db, "order.confirmed", { orderId }).catch(() => {});
        }
      }

      // PII stays out of logs: identify orders by id/number only.
      logger.info("order.created", {
        orderId,
        orderNumber,
        itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
        subtotalCents,
        shippingCents,
        handlingCents,
        totalCents,
        fulfillmentType: isShipping ? "shipping" : "pickup",
        pickupLocationName,
        pickupDate,
        pickupTime,
        userId,
        paymentFlow: checkoutUrl ? "stripe" : "pay_on_pickup",
      });

      // Confirmation emails flow through the outbox + queue (see the batch
      // above and the webhook), never inline — failures retry via cron.

      return { orderId, orderNumber, checkoutUrl, orderToken };
    } catch (caught) {
      try {
        if (orderPersisted) {
          // The order rows exist: cancel it so the expiry webhook (which only
          // matches pending orders) ignores the session, then release exactly
          // once here. Releasing without cancelling would double-restore
          // when the abandoned session later expires.
          await db
            .update(orders)
            .set({
              status: "cancelled",
              paymentStatus: "abandoned",
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(orders.id, orderId));
          logger.warn("order.cancelled_after_create_failure", { orderId });
        }
        await releaseReservedLines(db, reservedLines);
      } catch (releaseError) {
        logger.error("inventory.release_failed", {
          orderId,
          error: releaseError instanceof Error ? releaseError.message : String(releaseError),
        });
      }
      throw caught;
    }
  });

export const getOrder = createServerFn({ method: "GET" })
  .validator((data: { id: string; token?: string; sessionId?: string }) => data)
  .handler(async ({ data }) => {
    const db = dbRequired();
    let order = await db.query.orders.findFirst({
      where: eq(orders.id, data.id),
      with: { items: true, pickupLocation: true },
    });

    if (!order) {
      return null;
    }

    // Ownership: any of these proves the caller is entitled to this order.
    // Knowing a bare order UUID is never enough to read customer PII.
    const { userId, email } = await currentUserEmail();
    const ownsAsUser =
      (userId && order.userId === userId) ||
      (email && order.customerEmail.toLowerCase() === email.toLowerCase());
    const validToken = await verifyOrderToken(order.id, data.token);
    const stripeSessionMatches =
      Boolean(data.sessionId) &&
      Boolean(order.stripeCheckoutSessionId) &&
      data.sessionId === order.stripeCheckoutSessionId;

    if (!ownsAsUser && !validToken && !stripeSessionMatches) {
      return null;
    }

    // Sync payment state from Stripe, but never send email from a GET path —
    // the webhook is the notification path, and GETs must be side-effect free.
    if (order.status === "pending" && stripeSessionMatches && data.sessionId) {
      const stripe = await getStripeClient();
      if (stripe) {
        try {
          const session = await stripe.checkout.sessions.retrieve(data.sessionId);
          if (session.payment_status === "paid") {
            await db
              .update(orders)
              .set({
                status: "confirmed",
                paymentStatus: "paid",
                checkoutProvider: "stripe",
                updatedAt: sql`CURRENT_TIMESTAMP`,
              })
              .where(eq(orders.id, data.id));

            order = await db.query.orders.findFirst({
              where: eq(orders.id, data.id),
              with: { items: true, pickupLocation: true },
            });
          }
        } catch (err) {
          logger.error("stripe.retrieve_failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return order ?? null;
  });

/* ------------------------------------------------------------------ */
/* Shipping                                                            */
/* ------------------------------------------------------------------ */

/** Public checkout quote: USPS options for a cart + address, edge-cached. */
export const getShippingOptions = createServerFn({ method: "POST" })
  .validator((data: unknown) => shippingQuoteSchema.parse(data))
  .handler(async ({ data }) => {
    const db = dbRequired();
    if (!(await shippoConfigured())) {
      return { configured: false, options: [], totalOunces: 0, handlingFeeCents: 0 };
    }

    // Rate limit per IP: quoting hits Shippo's API; the cache covers repeats
    // but a script cycling ZIPs must not hammer it.
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const ip = clientIpFromHeaders(getRequestHeaders());
    const limit = await rateLimit(db, "quote-shipping", ip, 60, 12);
    if (!limit.ok) {
      throw new Error("Too many shipping quotes. Wait a moment and try again.");
    }

    const found = await db
      .select()
      .from(menuItems)
      .where(
        inArray(
          menuItems.id,
          data.items.map((item) => item.id),
        ),
      );
    const byId = new Map(found.map((item) => [item.id, item]));
    const lines = data.items.map((line) => {
      const item = byId.get(line.id);
      if (!item) {
        throw new Error("One or more cookies are no longer available.");
      }
      return { item, quantity: line.quantity };
    });

    const result = await quoteShippingRates({
      lines,
      addressTo: {
        name: data.address.name,
        line1: data.address.line1,
        line2: data.address.line2,
        city: data.address.city,
        state: data.address.state,
        zip: data.address.zip,
        country: data.address.country,
      },
    });
    const settings = await getShippingSettings();

    return {
      configured: true,
      options: result.options,
      totalOunces: result.totalOunces,
      handlingFeeCents: settings.handlingFeeCents,
    };
  });

export const getAdminShippingSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const settings = await getShippingSettings();
  return { settings, shippoConfigured: await shippoConfigured() };
});

const adminShippingSettingsSchema = z.object({
  fromAddress: z
    .object({
      name: z.string().min(2),
      street1: z.string().min(3),
      street2: z.string().optional().default(""),
      city: z.string().min(2),
      state: z.string().length(2),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/),
      country: z.literal("US").optional().default("US"),
    })
    .nullable(),
  handlingFeeCents: z.number().int().min(0).max(5000),
  box: z.object({
    lengthIn: z.number().min(0.1).max(36),
    widthIn: z.number().min(0.1).max(36),
    heightIn: z.number().min(0.1).max(36),
  }),
  compareZips: z
    .array(z.string().regex(/^\d{5}$/))
    .max(10)
    .default([]),
});

export const saveAdminShippingSettings = createServerFn({ method: "POST" })
  .validator((data: unknown) => adminShippingSettingsSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const settings: ShippingSettings = {
      fromAddress: data.fromAddress
        ? {
            name: data.fromAddress.name,
            street1: data.fromAddress.street1,
            street2: data.fromAddress.street2,
            city: data.fromAddress.city,
            state: data.fromAddress.state,
            zip: data.fromAddress.zip,
            country: data.fromAddress.country,
          }
        : null,
      handlingFeeCents: data.handlingFeeCents,
      box: data.box,
      compareZips: data.compareZips,
    };
    await saveShippingSettings(settings);
    logger.info("admin.shipping_settings_saved");
    return { ok: true, settings };
  });

/** Admin rate comparison: fresh Shippo quotes, never cached. */
export const getAdminShippingRatePreview = createServerFn({ method: "POST" })
  .validator((data: unknown) => adminRatePreviewSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    if (!(await shippoConfigured())) {
      return { configured: false, options: [], totalOunces: 0, handlingFeeCents: 0 };
    }

    const lines: { item: typeof menuItems.$inferSelect; quantity: number }[] = [];
    if (data.items && data.items.length > 0) {
      const db = dbRequired();
      const found = await db
        .select()
        .from(menuItems)
        .where(
          inArray(
            menuItems.id,
            data.items.map((item) => item.id),
          ),
        );
      const byId = new Map(found.map((item) => [item.id, item]));
      for (const line of data.items) {
        const item = byId.get(line.id);
        if (!item) {
          throw new Error("Unknown item in the rate preview.");
        }
        lines.push({ item, quantity: line.quantity });
      }
    }

    const result = await quoteShippingRates({
      lines,
      addressTo: {
        name: data.address.name,
        line1: data.address.line1,
        line2: data.address.line2,
        city: data.address.city,
        state: data.address.state,
        zip: data.address.zip,
        country: data.address.country,
      },
      noCache: true,
      ...(data.manualWeightOunces ? { manualTotalOunces: data.manualWeightOunces } : {}),
    });
    const settings = await getShippingSettings();

    return {
      configured: true,
      options: result.options,
      totalOunces: result.totalOunces,
      handlingFeeCents: settings.handlingFeeCents,
    };
  });

/** One-click bootstrap for the Shippo service group /live-rates depends on. */
export const adminEnsureShippingSetup = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const result = await ensureShippingServiceGroup();
  return result;
});

/* ------------------------------------------------------------------ */
/* Abandoned carts                                                     */
/* ------------------------------------------------------------------ */

const trackCartSchema = z.object({
  /** Stable cart id — same key used for order idempotency. */
  clientOrderId: z.string().uuid(),
  items: z.array(cartLineSchema).max(50).default([]),
});

/**
 * Debounced ping from the cart provider. Server-side prices only: item data
 * is re-loaded from the DB, never trusted from the client.
 */
export const trackCart = createServerFn({ method: "POST" })
  .validator((data: unknown) => trackCartSchema.parse(data))
  .handler(async ({ data }) => {
    const db = dbRequired();

    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const ip = clientIpFromHeaders(getRequestHeaders());
    const limit = await rateLimit(db, "track-cart", ip, 60 * 10, 120);
    if (!limit.ok) {
      return { ok: true, throttled: true };
    }

    const { userId, email } = await currentUserEmail();

    if (data.items.length === 0) {
      // Cart emptied: drop the snapshot so it stops counting as abandoned.
      await db.delete(cartSnapshotsTable).where(eq(cartSnapshotsTable.id, data.clientOrderId));
      return { ok: true, cleared: true };
    }

    const found = await db
      .select()
      .from(menuItems)
      .where(
        inArray(
          menuItems.id,
          data.items.map((item) => item.id),
        ),
      );
    const byId = new Map(found.map((item) => [item.id, item]));

    const lines: { id: string; name: string; quantity: number; priceCents: number }[] = [];
    for (const line of data.items) {
      const item = byId.get(line.id);
      if (!item) {
        continue;
      }
      lines.push({
        id: item.id,
        name: item.name,
        quantity: line.quantity,
        priceCents: item.priceCents,
      });
    }

    if (lines.length === 0) {
      return { ok: true, skipped: true };
    }

    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotalCents = lines.reduce((sum, line) => sum + line.quantity * line.priceCents, 0);

    await db
      .insert(cartSnapshotsTable)
      .values({
        id: data.clientOrderId,
        userId: userId ?? null,
        email: email ?? "",
        lines: JSON.stringify(lines),
        itemCount,
        subtotalCents,
        lastSeenAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: cartSnapshotsTable.id,
        set: {
          userId: userId ?? null,
          email: email ?? "",
          lines: JSON.stringify(lines),
          itemCount,
          subtotalCents,
          // A live touch cancels any queued abandonment email claim…
          lastSeenAt: sql`CURRENT_TIMESTAMP`,
          // …but an already-sent email stays sent (one per cart, ever).
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    return { ok: true };
  });

export const getAdminAbandonedCarts = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const db = dbRequired();
  const rows = await db
    .select()
    .from(cartSnapshotsTable)
    .orderBy(desc(cartSnapshotsTable.lastSeenAt))
    .limit(100);

  return rows.map((row) => {
    let lines: { name: string; quantity: number; priceCents: number }[] = [];
    try {
      lines = JSON.parse(row.lines);
    } catch {
      lines = [];
    }
    return {
      id: row.id,
      email: row.email,
      itemCount: row.itemCount,
      subtotalCents: row.subtotalCents,
      lastSeenAt: row.lastSeenAt,
      abandonedEmailSentAt: row.abandonedEmailSentAt,
      recoveredAt: row.recoveredAt,
      lines: lines.map((line) => ({ name: line.name, quantity: line.quantity })),
    };
  });
});

/* ------------------------------------------------------------------ */
/* Integrations sheet (admin-managed API keys)                          */
/* ------------------------------------------------------------------ */

export const getIntegrationSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const [stripeSecret, stripePublishable, stripeWebhook, shippoApi] = await Promise.all([
    integrationKeyStatus(INTEGRATION_KEY_IDS.stripeSecret),
    integrationKeyStatus(INTEGRATION_KEY_IDS.stripePublishable),
    integrationKeyStatus(INTEGRATION_KEY_IDS.stripeWebhook),
    integrationKeyStatus(INTEGRATION_KEY_IDS.shippoApi),
  ]);
  return {
    stripe: {
      secret: stripeSecret,
      publishable: stripePublishable,
      webhook: stripeWebhook,
      mode: await currentStripeMode(),
    },
    shippo: { api: shippoApi },
  };
});

const saveIntegrationKeysSchema = z.object({
  /** Empty string = clear; undefined = leave unchanged. */
  stripeSecret: z.string().trim().optional(),
  stripePublishable: z.string().trim().optional(),
  stripeWebhook: z.string().trim().optional(),
  shippoApi: z.string().trim().optional(),
});

/**
 * Save integration keys from the admin sheet. Every non-empty value is
 * validated LIVE before it's stored (Stripe: balance lookup; Shippo: a
 * cheap authenticated read), so a typo can never take checkout or shipping
 * down. On a Stripe secret change the menu syncs to the new account
 * immediately ("on save, sync stripe").
 */
export const saveIntegrationKeys = createServerFn({ method: "POST" })
  .validator((data: unknown) => saveIntegrationKeysSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = dbRequired();

    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const ip = clientIpFromHeaders(getRequestHeaders());
    const limit = await rateLimit(db, "save-integration-keys", ip, 60 * 10, 20);
    if (!limit.ok) {
      throw new Error("Too many save attempts. Wait a few minutes and try again.");
    }

    let stripeSynced: { synced: number; total: number } | null = null;
    let stripeSecretChanged = false;

    if (typeof data.stripeSecret === "string" && data.stripeSecret) {
      if (!data.stripeSecret.match(/^sk_(test|live)_/)) {
        throw new Error("Stripe secret keys start with sk_test_ or sk_live_.");
      }
      // Validate live before storing: never let a bad key enter the store.
      const probe = stripeClientFor(data.stripeSecret);
      try {
        await probe.balance.retrieve();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Stripe rejected that key: ${message.slice(0, 200)}`);
      }
      await storeIntegrationKey(INTEGRATION_KEY_IDS.stripeSecret, data.stripeSecret);
      stripeSecretChanged = true;
    } else if (data.stripeSecret === "") {
      await storeIntegrationKey(INTEGRATION_KEY_IDS.stripeSecret, "");
    }

    if (typeof data.stripePublishable === "string" && data.stripePublishable) {
      if (!data.stripePublishable.match(/^pk_(test|live)_/)) {
        throw new Error("Stripe publishable keys start with pk_test_ or pk_live_.");
      }
      await storeIntegrationKey(INTEGRATION_KEY_IDS.stripePublishable, data.stripePublishable);
    } else if (data.stripePublishable === "") {
      await storeIntegrationKey(INTEGRATION_KEY_IDS.stripePublishable, "");
    }

    if (typeof data.stripeWebhook === "string" && data.stripeWebhook) {
      if (!data.stripeWebhook.startsWith("whsec_")) {
        throw new Error("Stripe webhook signing secrets start with whsec_.");
      }
      await storeIntegrationKey(INTEGRATION_KEY_IDS.stripeWebhook, data.stripeWebhook);
    } else if (data.stripeWebhook === "") {
      await storeIntegrationKey(INTEGRATION_KEY_IDS.stripeWebhook, "");
    }

    if (typeof data.shippoApi === "string" && data.shippoApi) {
      if (!/^shippo_(test|live)_/.exec(data.shippoApi)) {
        throw new Error("Shippo API tokens start with shippo_test_ or shippo_live_.");
      }
      const probe = shippoClientFor(data.shippoApi);
      try {
        await probe.serviceGroups.list({});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Shippo rejected that key: ${message.slice(0, 200)}`);
      }
      await storeIntegrationKey(INTEGRATION_KEY_IDS.shippoApi, data.shippoApi);
    } else if (data.shippoApi === "") {
      await storeIntegrationKey(INTEGRATION_KEY_IDS.shippoApi, "");
    }

    // "On save, sync Stripe": a new secret means a new (or newly connected)
    // account — sync products and prices right away so checkout works.
    if (stripeSecretChanged) {
      const stripe = await getStripeClient();
      if (stripe) {
        stripeSynced = await syncMenuItemsToStripe(stripe);
      }
    }

    logger.info("admin.integration_keys_saved", {
      stripeSecretChanged,
      stripeSynced: stripeSynced?.synced ?? null,
      cleared: [
        data.stripeSecret === "" ? "stripe_secret" : null,
        data.stripePublishable === "" ? "stripe_publishable" : null,
        data.stripeWebhook === "" ? "stripe_webhook" : null,
        data.shippoApi === "" ? "shippo_api" : null,
      ].filter(Boolean),
    });

    return { ok: true, stripeSynced };
  });

export const getAdminOrder = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin();
    if (!hasDatabase()) {
      return null;
    }
    const order = await dbRequired().query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true, pickupLocation: true },
    });

    return order ?? null;
  });

export const getAccountOrders = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) {
    return [];
  }

  const db = dbRequired();
  const { userId, email } = await currentUserEmail();
  if (!userId && !email) {
    return [];
  }

  return db.query.orders.findMany({
    where: userId ? eq(orders.userId, userId) : eq(orders.customerEmail, email ?? ""),
    with: { items: true, pickupLocation: true },
    orderBy: desc(orders.createdAt),
  });
});

export const getAccountOrder = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    if (!hasDatabase()) {
      return null;
    }

    const db = dbRequired();
    const { userId, email } = await currentUserEmail();
    if (!userId && !email) {
      return null;
    }

    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, id),
        userId ? eq(orders.userId, userId) : eq(orders.customerEmail, email ?? ""),
      ),
      with: { items: true, pickupLocation: true },
    });

    return order ?? null;
  });

export const getAdminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  if (!hasDatabase()) {
    return {
      items: seedMenu,
      recentOrders: [],
      todaysMenu: [],
      shopDays: [],
      locations: seedPickupLocations,
      statuses: orderStatuses,
    };
  }
  const db = dbRequired();
  const [items, recentOrders, todaysMenu, shopDays, locations] = await Promise.all([
    db.select().from(menuItems).orderBy(asc(menuItems.sortOrder), asc(menuItems.name)),
    db.query.orders.findMany({
      with: { items: true, pickupLocation: true },
      orderBy: desc(orders.createdAt),
      limit: 30,
    }),
    db.query.dailyMenuItems.findMany({
      with: { menuItem: true },
      orderBy: desc(dailyMenuItems.menuDate),
      limit: 30,
    }),
    db.query.shopDaySettings.findMany({
      orderBy: desc(shopDaySettings.dayDate),
      limit: 60,
    }),
    getOrCreatePickupLocations(db),
  ]);

  return { items, recentOrders, todaysMenu, shopDays, locations, statuses: orderStatuses };
});

export const saveMenuItem = createServerFn({ method: "POST" })
  .validator((data: unknown) => itemSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = dbRequired();
    const id = data.id || crypto.randomUUID();

    let stripeProductId = data.stripeProductId || null;
    let stripePriceId = data.stripePriceId || null;

    const stripe = await getStripeClient();
    if (stripe) {
      try {
        if (!stripeProductId) {
          const product = await stripe.products.create({
            name: data.name,
            description: data.description || undefined,
          });
          stripeProductId = product.id;

          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: data.priceCents,
            currency: "usd",
          });
          stripePriceId = price.id;
        } else {
          await stripe.products.update(stripeProductId, {
            name: data.name,
            description: data.description || undefined,
          });

          let createNewPrice = false;
          if (data.id) {
            const existing = await db
              .select()
              .from(menuItems)
              .where(eq(menuItems.id, data.id))
              .get();
            if (existing && existing.priceCents !== data.priceCents) {
              createNewPrice = true;
            }
          }
          if (createNewPrice || !stripePriceId) {
            const price = await stripe.prices.create({
              product: stripeProductId,
              unit_amount: data.priceCents,
              currency: "usd",
            });
            stripePriceId = price.id;
          }
        }
      } catch (err) {
        logger.error("stripe.sync_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const values = {
      id,
      name: data.name,
      slug: normalizeSlug(data.slug || data.name),
      category: data.category,
      description: data.description,
      ingredients: data.ingredients || "Ask for ingredients",
      allergens: data.allergens,
      priceCents: data.priceCents,
      inventoryQuantity: data.inventoryQuantity,
      trackInventory: data.trackInventory,
      available: data.available,
      featured: data.featured,
      imageKey: data.imageKey || null,
      imageAlt: data.imageAlt,
      stripeProductId,
      stripePriceId,
      sortOrder: data.sortOrder,
      weightOunces: data.weightOunces,
      weightMaxOunces: data.weightMaxOunces ?? null,
      isShippable: data.isShippable,
      packSize: data.packSize ?? null,
      packTareOunces: data.packTareOunces,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };

    // Pack contents must sum to the pack size so a "6-pack" really holds six.
    if (data.packSize && data.packContents && data.packContents.length > 0) {
      const total = data.packContents.reduce((sum, content) => sum + content.quantity, 0);
      if (total !== data.packSize) {
        throw new Error(
          `Pack contents add up to ${total} cookies, but this is a ${data.packSize}-pack. Adjust the quantities.`,
        );
      }
    }

    if (data.id) {
      await db.update(menuItems).set(values).where(eq(menuItems.id, data.id));
    } else {
      await db.insert(menuItems).values(values);
    }

    // Replace-all for pack contents keeps recipes simple to edit.
    if (data.packSize) {
      await db.delete(packContentsTable).where(eq(packContentsTable.packItemId, id));
      if (data.packContents && data.packContents.length > 0) {
        await db.insert(packContentsTable).values(
          data.packContents.map((content) => ({
            id: crypto.randomUUID(),
            packItemId: id,
            cookieItemId: content.cookieItemId,
            quantity: content.quantity,
          })),
        );
      }
    }

    logger.info("admin.menu_item_saved", {
      id,
      name: data.name,
      category: data.category,
      available: data.available,
      featured: data.featured,
      inventoryQuantity: data.inventoryQuantity,
      packSize: data.packSize ?? null,
    });

    return { id };
  });

/**
 * Sync every menu item to Stripe (products + prices). Shared by the admin
 * sync button and the Integrations-sheet save flow ("on save, sync Stripe").
 */
async function syncMenuItemsToStripe(
  stripe: import("stripe").Stripe,
): Promise<{ synced: number; total: number }> {
  const db = dbRequired();
  const items = await db.select().from(menuItems);
  let synced = 0;

  for (const item of items) {
    try {
      let prodId = item.stripeProductId;
      if (!prodId) {
        const prod = await stripe.products.create({
          name: item.name,
          description: item.description || undefined,
        });
        prodId = prod.id;
      } else {
        await stripe.products.update(prodId, {
          name: item.name,
          description: item.description || undefined,
        });
      }

      let priceId = item.stripePriceId;
      if (!priceId) {
        const pr = await stripe.prices.create({
          product: prodId,
          unit_amount: item.priceCents,
          currency: "usd",
        });
        priceId = pr.id;
      }

      await db
        .update(menuItems)
        .set({
          stripeProductId: prodId,
          stripePriceId: priceId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(menuItems.id, item.id));

      synced++;
    } catch (err) {
      logger.error("stripe.sync_all_failed_item", {
        itemId: item.id,
        error: String(err),
      });
    }
  }

  logger.info("stripe.sync_all_completed", { synced, total: items.length });
  return { synced, total: items.length };
}

export const syncAllItemsToStripe = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const stripe = await getStripeClient();
  if (!stripe) {
    return { success: false, message: "Stripe is not configured in this environment." };
  }

  const result = await syncMenuItemsToStripe(stripe);
  return { success: true, ...result };
});

export const uploadMenuPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();

    // Hardened upload: image content types only, and a hard size cap so a
    // stray base64 payload can't exhaust worker memory.
    const contentType = data.contentType.toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw new Error("Only PNG, JPEG, WebP, or AVIF images can be uploaded.");
    }
    // base64 inflates by ~4/3; check the decoded size, not the string length.
    const decodedBytes = Math.floor((data.base64.length * 3) / 4);
    if (decodedBytes > MAX_UPLOAD_BYTES) {
      throw new Error("Images must be smaller than 5 MB.");
    }

    const extension = contentType.split("/")[1] ?? "png";
    const safeName = data.fileName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "");
    const key = `items/${crypto.randomUUID()}-${safeName}.${extension}`;
    const bytes = Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0));
    await env.MEDIA.put(key, bytes, {
      httpMetadata: {
        contentType,
      },
    });

    logger.info("admin.menu_photo_uploaded", { key, contentType, bytes: decodedBytes });

    return { key };
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin();
    await dbRequired().delete(menuItems).where(eq(menuItems.id, id));
    logger.info("admin.menu_item_deleted", { id });
    return { ok: true };
  });

export const saveDailyMenuItem = createServerFn({ method: "POST" })
  .validator((data: unknown) => dailyMenuSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = dbRequired();
    const existing = await db.query.dailyMenuItems.findFirst({
      where: and(
        eq(dailyMenuItems.menuItemId, data.menuItemId),
        eq(dailyMenuItems.menuDate, data.menuDate),
      ),
    });

    const values = {
      menuItemId: data.menuItemId,
      menuDate: data.menuDate,
      availableOverride: data.availableOverride,
      featuredOverride: data.featuredOverride,
      note: data.note,
    };

    if (existing) {
      await db.update(dailyMenuItems).set(values).where(eq(dailyMenuItems.id, existing.id));
      logger.info("admin.daily_menu_saved", { id: existing.id, ...values });
      return { id: existing.id };
    }

    const id = crypto.randomUUID();
    await db.insert(dailyMenuItems).values({ id, ...values });
    logger.info("admin.daily_menu_saved", { id, ...values });
    return { id };
  });

export const saveWeeklyMenu = createServerFn({ method: "POST" })
  .validator((data: unknown) => weeklyMenuSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = dbRequired();
    const weekDates = Array.from({ length: 7 }, (_, index) => addDaysIso(data.weekStart, index));
    const rows = await db
      .select()
      .from(dailyMenuItems)
      .where(inArray(dailyMenuItems.menuDate, weekDates));

    const existing = new Map(rows.map((row) => [`${row.menuItemId}:${row.menuDate}`, row]));
    const desired = new Set(
      Object.entries(data.itemDays).flatMap(([menuItemId, dates]) =>
        dates.map((date) => `${menuItemId}:${date}`),
      ),
    );

    await Promise.all(
      weekDates.map(async (dayDate) => {
        const existing = await db.query.shopDaySettings.findFirst({
          where: eq(shopDaySettings.dayDate, dayDate),
        });
        const values = {
          dayDate,
          closed: data.closedDates.includes(dayDate),
          note: data.closedDates.includes(dayDate) ? "Closed" : "",
          updatedAt: sql`CURRENT_TIMESTAMP`,
        };
        if (existing) {
          await db.update(shopDaySettings).set(values).where(eq(shopDaySettings.id, existing.id));
          return;
        }
        await db.insert(shopDaySettings).values({ id: crypto.randomUUID(), ...values });
      }),
    );

    await Promise.all(
      Object.entries(data.itemDays).flatMap(([menuItemId, dates]) =>
        dates.map(async (menuDate) => {
          const key = `${menuItemId}:${menuDate}`;
          const row = existing.get(key);
          if (row) {
            await db
              .update(dailyMenuItems)
              .set({ availableOverride: true })
              .where(eq(dailyMenuItems.id, row.id));
            return;
          }

          await db.insert(dailyMenuItems).values({
            id: crypto.randomUUID(),
            menuItemId,
            menuDate,
            availableOverride: true,
            featuredOverride: null,
            note: "",
          });
        }),
      ),
    );

    await Promise.all(
      rows
        .filter((row) => !desired.has(`${row.menuItemId}:${row.menuDate}`))
        .map((row) =>
          db
            .update(dailyMenuItems)
            .set({ availableOverride: false })
            .where(eq(dailyMenuItems.id, row.id)),
        ),
    );

    logger.info("admin.weekly_menu_saved", { weekStart: data.weekStart });
    return { ok: true };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ id: z.string().min(1), status: z.enum(orderStatuses) }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await dbRequired()
      .update(orders)
      .set({ status: data.status, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(orders.id, data.id));
    logger.info("admin.order_status_updated", { id: data.id, status: data.status });
    return { ok: true };
  });
