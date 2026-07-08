import { createDb } from "@sweettreats/db";
import { getAuth } from "./auth-server";
import {
  dailyMenuItems,
  menuItems,
  orderItems,
  orders,
  orderStatuses,
  shopDaySettings,
} from "@sweettreats/db/schema/index";
import { env } from "@sweettreats/env/server";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";

function getStripeClient() {
  const stripeSecretKey = (env as any).STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
}

import { logger } from "./logger";
import { isAdminAuthDisabled, isAdminPreviewMode } from "./clerk-env";

const cartLineSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().min(1).max(24),
});

const checkoutSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[0-9()\-\s]{7,20}$/, "Enter a valid phone number."),
  pickupDate: z.string().min(10),
  pickupTime: z.string().min(4),
  notes: z.string().max(500).optional().default(""),
  items: z.array(cartLineSchema).min(1),
});

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  slug: z.string().optional().default(""),
  category: z.string().min(2),
  description: z.string().min(8),
  ingredients: z.string().optional().default(""),
  allergens: z.string().optional().default(""),
  priceCents: z.number().int().min(1),
  inventoryQuantity: z.number().int().min(0).default(0),
  trackInventory: z.boolean().default(false),
  available: z.boolean(),
  featured: z.boolean(),
  imageKey: z.string().optional().nullable(),
  imageAlt: z.string().optional().default("Sweet Treats LR cookie"),
  stripeProductId: z.string().optional().nullable(),
  stripePriceId: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
});

const uploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(3),
  base64: z.string().min(1),
});

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

function shopDateIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function addDaysIso(dateIso: string, days: number) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

async function menuForDate(db: ReturnType<typeof createDb>, menuDate: string) {
  const day = await db.query.shopDaySettings.findFirst({
    where: eq(shopDaySettings.dayDate, menuDate),
  });

  if (day?.closed) {
    return { menuDate, closed: true, closedNote: day.note, items: [] };
  }

  const rows = await db
    .select({
      item: menuItems,
      daily: dailyMenuItems,
    })
    .from(menuItems)
    .leftJoin(
      dailyMenuItems,
      and(eq(dailyMenuItems.menuItemId, menuItems.id), eq(dailyMenuItems.menuDate, menuDate)),
    )
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name));

  const items = rows
    .map(({ item, daily }) => ({
      ...item,
      todayNote: daily?.note ?? "",
      available:
        (daily?.availableOverride ?? item.available) &&
        (!item.trackInventory || item.inventoryQuantity > 0),
      featured: daily?.featuredOverride ?? item.featured,
      dailyMenuId: daily?.id ?? null,
    }))
    .filter((item) => item.available || item.featured);

  return { menuDate, closed: false, closedNote: day?.note ?? "", items };
}

async function nextAvailableMenu(db: ReturnType<typeof createDb>, startDate = shopDateIso()) {
  for (let offset = 0; offset < 21; offset += 1) {
    const menu = await menuForDate(db, addDaysIso(startDate, offset));
    if (!menu.closed && menu.items.some((item) => item.available)) {
      return menu;
    }
  }

  return menuForDate(db, startDate);
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
    createdAt: "",
    updatedAt: "",
  },
] satisfies (typeof menuItems.$inferSelect)[];

function hasDatabase() {
  return !!env.DB;
}

function dbRequired() {
  if (!hasDatabase()) {
    throw new Error("Cloudflare D1 binding is not available. Run through Alchemy/Cloudflare dev.");
  }

  return createDb();
}

async function currentUserEmail() {
  const { getRequestHeaders } = await import("@tanstack/react-start/server");
  const headers = getRequestHeaders();
  const session = await getAuth().api.getSession({ headers });
  if (!session) {
    return { userId: null, email: null, role: null };
  }

  const email = session.user.email;
  const allowed = adminEmails();
  const isAdmin = email ? allowed.includes(email.toLowerCase()) : false;
  const role = isAdmin ? "admin" : null;

  return { userId: session.user.id, email, role };
}

function adminEmails() {
  return String(env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin() {
  if (isAdminAuthDisabled() || isAdminPreviewMode()) {
    return;
  }

  const { email, role, userId } = await currentUserEmail();
  const allowed = adminEmails();
  const emailAllowed = email ? allowed.includes(email.toLowerCase()) : false;
  const roleAllowed = role === "admin" || role === "owner";

  if (!emailAllowed && !roleAllowed) {
    logger.warn("admin.access_denied", { email, role, userId });
    throw new Error("Admin access required");
  }
}

export const getMenu = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) {
    return seedMenu;
  }

  const db = createDb();
  const items = await db
    .select()
    .from(menuItems)
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name));
  return items.map((item) => ({
    ...item,
    available: item.available && (!item.trackInventory || item.inventoryQuantity > 0),
  }));
});

export const getTodayMenu = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) {
    return {
      menuDate: shopDateIso(),
      requestedDate: shopDateIso(),
      closed: false,
      closedNote: "",
      items: seedMenu.map((item) => ({ ...item, todayNote: "", dailyMenuId: null })),
    };
  }

  const db = createDb();
  const today = shopDateIso();
  const menu = await nextAvailableMenu(db, today);
  return { ...menu, requestedDate: today };
});

export const getPickupAvailability = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) {
    return { pickupDate: shopDateIso(), closed: false };
  }

  const menu = await nextAvailableMenu(createDb());
  return { pickupDate: menu.menuDate, closed: menu.closed };
});

export const getMenuItem = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    if (!hasDatabase()) {
      return seedMenu.find((item) => item.id === id) ?? null;
    }

    const db = createDb();
    return db.query.menuItems.findFirst({
      where: eq(menuItems.id, id),
    });
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

    return dbRequired().query.menuItems.findFirst({
      where: eq(menuItems.id, id),
    });
  });

export const createOrder = createServerFn({ method: "POST" })
  .validator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }) => {
    const db = dbRequired();
    const ids = data.items.map((item) => item.id);
    const foundItems = await db.select().from(menuItems).where(inArray(menuItems.id, ids));
    const byId = new Map(foundItems.map((item) => [item.id, item]));

    const lines = data.items.map((line) => {
      const item = byId.get(line.id);
      if (!item || !item.available) {
        throw new Error("One or more cookies are no longer available.");
      }
      if (item.trackInventory && item.inventoryQuantity < line.quantity) {
        throw new Error(`${item.name} does not have enough inventory left.`);
      }

      return {
        item,
        quantity: line.quantity,
        lineTotalCents: item.priceCents * line.quantity,
      };
    });

    const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
    const { userId } = await currentUserEmail();
    const orderId = crypto.randomUUID();
    const orderNumber = `ST-${Date.now().toString(36).toUpperCase()}`;
    const pickupMenu = await nextAvailableMenu(db, data.pickupDate);
    const pickupDate = pickupMenu.menuDate;

    const reservedLines: { itemId: string; quantity: number }[] = [];
    for (const line of lines) {
      if (line.item.trackInventory) {
        const reserved = await db
          .update(menuItems)
          .set({
            inventoryQuantity: sql`${menuItems.inventoryQuantity} - ${line.quantity}`,
            available: sql`CASE WHEN ${menuItems.inventoryQuantity} - ${line.quantity} > 0 THEN 1 ELSE 0 END`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(menuItems.id, line.item.id),
              eq(menuItems.available, true),
              gte(menuItems.inventoryQuantity, line.quantity),
            ),
          )
          .returning({ id: menuItems.id });

        if (reserved.length === 0) {
          throw new Error(`${line.item.name} just sold out or does not have enough left.`);
        }

        reservedLines.push({ itemId: line.item.id, quantity: line.quantity });
      }
    }

    try {
      const { getRequestHeaders } = await import("@tanstack/react-start/server");
      const requestHeaders = getRequestHeaders();
      const referer = requestHeaders.get("referer");
      const origin = referer ? new URL(referer).origin : "http://localhost:8787";

      const successUrl = `${origin}/order/success?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/checkout`;

      const stripe = getStripeClient();
      let checkoutUrl: string | null = null;
      let stripeCheckoutSessionId: string | null = null;

      if (stripe) {
        try {
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: lines.map((line) => {
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
            mode: "payment",
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: data.email || undefined,
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

      await db.insert(orders).values({
        id: orderId,
        orderNumber,
        userId: userId,
        customerName: data.name,
        customerEmail: data.email,
        customerPhone: data.phone,
        pickupDate,
        pickupTime: data.pickupTime,
        notes: data.notes,
        status: checkoutUrl ? "pending" : "confirmed",
        stripeCheckoutSessionId,
        subtotalCents,
      });

      await db.insert(orderItems).values(
        lines.map((line) => ({
          id: crypto.randomUUID(),
          orderId,
          menuItemId: line.item.id,
          itemNameSnapshot: line.item.name,
          itemDescriptionSnapshot: line.item.description,
          unitPriceCentsSnapshot: line.item.priceCents,
          quantity: line.quantity,
          lineTotalCents: line.lineTotalCents,
        })),
      );

      logger.info("order.created", {
        orderId,
        orderNumber,
        itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
        subtotalCents,
        customerEmail: data.email,
        userId,
      });

      return { orderId, orderNumber, checkoutUrl };
    } catch (caught) {
      await Promise.all(
        reservedLines.map((line) =>
          db
            .update(menuItems)
            .set({
              inventoryQuantity: sql`${menuItems.inventoryQuantity} + ${line.quantity}`,
              available: true,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(menuItems.id, line.itemId)),
        ),
      );
      throw caught;
    }
  });

export const getOrder = createServerFn({ method: "GET" })
  .validator((data: { id: string; sessionId?: string }) => data)
  .handler(async ({ data }) => {
    const db = dbRequired();
    let order = await db.query.orders.findFirst({
      where: eq(orders.id, data.id),
      with: { items: true },
    });

    if (order && order.status === "pending" && data.sessionId) {
      const stripe = getStripeClient();
      if (stripe) {
        try {
          const session = await stripe.checkout.sessions.retrieve(data.sessionId);
          if (session.payment_status === "paid") {
            await db.update(orders).set({ status: "confirmed" }).where(eq(orders.id, data.id));

            order = await db.query.orders.findFirst({
              where: eq(orders.id, data.id),
              with: { items: true },
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

export const getAdminOrder = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    await requireAdmin();
    const order = await dbRequired().query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true },
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
    with: { items: true },
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
      with: { items: true },
    });

    return order ?? null;
  });

export const getAdminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const db = dbRequired();
  const [items, recentOrders, todaysMenu, shopDays] = await Promise.all([
    db.select().from(menuItems).orderBy(asc(menuItems.sortOrder), asc(menuItems.name)),
    db.query.orders.findMany({
      with: { items: true },
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
  ]);

  return { items, recentOrders, todaysMenu, shopDays, statuses: orderStatuses };
});

export const saveMenuItem = createServerFn({ method: "POST" })
  .validator((data: unknown) => itemSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = dbRequired();
    const id = data.id || crypto.randomUUID();

    let stripeProductId = data.stripeProductId || null;
    let stripePriceId = data.stripePriceId || null;

    const stripe = getStripeClient();
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
          if (createNewPrice) {
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
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };

    if (data.id) {
      await db.update(menuItems).set(values).where(eq(menuItems.id, data.id));
    } else {
      await db.insert(menuItems).values(values);
    }

    logger.info("admin.menu_item_saved", {
      id,
      name: data.name,
      category: data.category,
      available: data.available,
      featured: data.featured,
      inventoryQuantity: data.inventoryQuantity,
    });

    return { id };
  });

export const uploadMenuPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const safeName = data.fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const key = `items/${crypto.randomUUID()}-${safeName}`;
    const bytes = Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0));
    await env.MEDIA.put(key, bytes, {
      httpMetadata: {
        contentType: data.contentType,
      },
    });

    logger.info("admin.menu_photo_uploaded", { key, contentType: data.contentType });

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

export const getAdminEmails = createServerFn({ method: "GET" }).handler(async () => adminEmails());
