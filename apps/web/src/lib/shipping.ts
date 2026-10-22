import { Shippo } from "shippo";
import { createDb } from "@sweettreats/db";
import { menuItems, orderItems, packContents, shopSettings } from "@sweettreats/db/schema/index";
import { eq, inArray, sql } from "drizzle-orm";

import { logger } from "./logger";
import { INTEGRATION_KEY_IDS, resolveIntegrationKey } from "./secure-settings";

/**
 * Shippo shipping integration.
 *
 * Integrity rules (mirroring the Stripe posture):
 * - The browser is never trusted for money: checkout quotes are display-only
 *   `LiveRate` data; at order creation the server re-quotes Shippo fresh and
 *   charges whatever Shippo says, matching the option by service title.
 * - Weights always come from the DB (never the cart) and always round UP.
 * - The public quote endpoint is rate-limited and edge-cached so address
 *   typing can't hammer Shippo's API or trip quotas.
 */

type Db = ReturnType<typeof createDb>;

export type MenuItemRow = typeof menuItems.$inferSelect;

export type ShippingFromAddress = {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
};

export type ShippingSettings = {
  fromAddress: ShippingFromAddress | null;
  /** Flat handling fee added on top of the carrier rate, in cents. */
  handlingFeeCents: number;
  /** Box dimensions used for rate quotes, in inches. */
  box: { lengthIn: number; widthIn: number; heightIn: number };
  /** ZIPs saved on the admin rate-compare page. */
  compareZips: string[];
};

const DEFAULT_SETTINGS: ShippingSettings = {
  fromAddress: null,
  handlingFeeCents: 100,
  box: { lengthIn: 12, widthIn: 9, heightIn: 4 },
  compareZips: [],
};

const SETTINGS_KEY = "shipping";

export async function getShippingSettings(): Promise<ShippingSettings> {
  const db = createDb();
  const row = await db.query.shopSettings.findFirst({
    where: eq(shopSettings.key, SETTINGS_KEY),
  });
  if (!row) {
    return DEFAULT_SETTINGS;
  }
  try {
    const parsed = JSON.parse(row.value) as Partial<ShippingSettings>;
    return {
      fromAddress: parsed.fromAddress ?? DEFAULT_SETTINGS.fromAddress,
      handlingFeeCents:
        typeof parsed.handlingFeeCents === "number"
          ? Math.max(0, Math.round(parsed.handlingFeeCents))
          : DEFAULT_SETTINGS.handlingFeeCents,
      box: {
        lengthIn: parsed.box?.lengthIn ?? DEFAULT_SETTINGS.box.lengthIn,
        widthIn: parsed.box?.widthIn ?? DEFAULT_SETTINGS.box.widthIn,
        heightIn: parsed.box?.heightIn ?? DEFAULT_SETTINGS.box.heightIn,
      },
      compareZips: Array.isArray(parsed.compareZips)
        ? parsed.compareZips.filter((z) => typeof z === "string").slice(0, 10)
        : [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveShippingSettings(next: ShippingSettings): Promise<ShippingSettings> {
  const db = createDb();
  const value = JSON.stringify(next);
  await db
    .insert(shopSettings)
    .values({ key: SETTINGS_KEY, value })
    .onConflictDoUpdate({
      target: shopSettings.key,
      set: { value, updatedAt: sql`CURRENT_TIMESTAMP` },
    });
  return next;
}

let shippoClient: { key: string; client: Shippo } | null = null;

async function getShippoClient(): Promise<Shippo | null> {
  const key = await resolveIntegrationKey(INTEGRATION_KEY_IDS.shippoApi);
  if (!key) {
    return null;
  }
  if (shippoClient?.key === key) {
    return shippoClient.client;
  }
  shippoClient = { key, client: new Shippo({ apiKeyHeader: key }) };
  return shippoClient.client;
}

/** Validating constructor used by the sheet save flow — never cached. */
export function shippoClientFor(key: string): Shippo {
  return new Shippo({ apiKeyHeader: key });
}

/* ------------------------------------------------------------------ */
/* Raw Shippo API (shipments + label purchase)                          */
/* ------------------------------------------------------------------ */

async function shippoResolveKey(): Promise<string> {
  return resolveIntegrationKey(INTEGRATION_KEY_IDS.shippoApi);
}

/** Create a Shippo shipment and get available rates. */
export async function createShippoShipment(input: {
  fromAddress: ShippingFromAddress;
  toAddress: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  weightOunces: number;
  box: { lengthIn: number; widthIn: number; heightIn: number };
}): Promise<{
  shipmentId: string;
  rates: {
    objectId: string;
    amount: string;
    provider: string;
    serviceLevelName: string;
    estimatedDays: number | null;
  }[];
}> {
  const key = await shippoResolveKey();
  if (!key) throw new Error("Shippo is not configured.");

  const response = await fetch("https://api.goshippo.com/shipments", {
    method: "POST",
    headers: { Authorization: `ShippoToken ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      address_from: {
        name: input.fromAddress.name,
        street1: input.fromAddress.street1,
        street2: input.fromAddress.street2 || "",
        city: input.fromAddress.city,
        state: input.fromAddress.state,
        zip: input.fromAddress.zip,
        country: input.fromAddress.country || "US",
      },
      address_to: {
        name: input.toAddress.name,
        street1: input.toAddress.street1,
        street2: input.toAddress.street2 || "",
        city: input.toAddress.city,
        state: input.toAddress.state,
        zip: input.toAddress.zip,
        country: input.toAddress.country || "US",
      },
      parcels: [
        {
          mass_unit: "oz",
          weight: String(input.weightOunces),
          distance_unit: "in",
          length: String(input.box.lengthIn),
          width: String(input.box.widthIn),
          height: String(input.box.heightIn),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Shippo shipment failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const shipment = (await response.json()) as {
    object_id: string;
    rates: Array<{
      object_id: string;
      amount: string;
      amount_local: string;
      provider: string;
      servicelevel: { name: string };
      days: number | null;
      duration_terms: string;
    }>;
  };

  // Sort cheapest first — the admin's default is "show me the best deal."
  const rates = (shipment.rates || [])
    .map((rate) => ({
      objectId: rate.object_id,
      amount: rate.amount || rate.amount_local || "0",
      provider: rate.provider,
      serviceLevelName: rate.servicelevel?.name || rate.provider,
      estimatedDays: rate.days,
    }))
    .sort((a, b) => Number(a.amount) - Number(b.amount));

  return { shipmentId: shipment.object_id, rates };
}

/** Purchase a shipping label for a specific rate. */
export async function purchaseShippoLabel(input: { rateId: string }): Promise<{
  transactionId: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
  amount: string;
  provider: string;
  serviceLevelName: string;
}> {
  const key = await shippoResolveKey();
  if (!key) throw new Error("Shippo is not configured.");

  const response = await fetch("https://api.goshippo.com/transactions", {
    method: "POST",
    headers: { Authorization: `ShippoToken ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      rate: input.rateId,
      label_file_type: "PDF",
      async: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Label purchase failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const transaction = (await response.json()) as {
    object_id: string;
    status: string;
    label_url: string;
    tracking_number: string;
    tracking_url: string;
    rate: { amount: string; provider: string; servicelevel: { name: string } };
  };

  if (transaction.status !== "SUCCESS" && transaction.status !== "QUEUED") {
    throw new Error(`Label purchase status: ${transaction.status}`);
  }

  return {
    transactionId: transaction.object_id,
    trackingNumber: transaction.tracking_number,
    trackingUrl: transaction.tracking_url,
    labelUrl: transaction.label_url,
    amount: transaction.rate?.amount ?? "0",
    provider: transaction.rate?.provider ?? "",
    serviceLevelName: transaction.rate?.servicelevel?.name ?? "",
  };
}

/** Compute the shipment weight for an existing order (from current item data). */
export async function computeOrderWeight(orderId: string): Promise<number> {
  const db = createDb();
  const rows = await db
    .select({ menuItemId: orderItems.menuItemId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const itemIds = [...new Set(rows.map((row) => row.menuItemId).filter(Boolean))] as string[];
  if (itemIds.length === 0) return 0;

  const items = await db.select().from(menuItems).where(inArray(menuItems.id, itemIds));
  const byId = new Map(items.map((item) => [item.id, item]));

  const packIds = items.filter((item) => item.packSize).map((item) => item.id);
  const contentsByPackId = await loadPackContentsByPackIds(db, packIds);

  let totalOunces = 0;
  for (const row of rows) {
    if (!row.menuItemId) continue;
    const item = byId.get(row.menuItemId);
    if (!item || !item.isShippable) continue;

    if (item.packSize) {
      const contents = contentsByPackId.get(item.id) ?? [];
      let packOunces = item.packTareOunces;
      for (const content of contents) {
        packOunces += unitWeightOunces(content.cookie ?? item) * content.quantity;
      }
      totalOunces += packOunces * row.quantity;
    } else {
      totalOunces += unitWeightOunces(item) * row.quantity;
    }
  }

  return Math.ceil(totalOunces);
}

export async function shippoConfigured(): Promise<boolean> {
  return (await getShippoClient()) !== null;
}

/* ------------------------------------------------------------------ */
/* Packs: contents, availability, weights                              */
/* ------------------------------------------------------------------ */

export type PackContentRow = {
  cookieItemId: string;
  quantity: number;
  cookie: ShippableItemLite | null;
};

export async function loadPackContentsByPackIds(
  db: Db,
  packIds: string[],
): Promise<Map<string, PackContentRow[]>> {
  const map = new Map<string, PackContentRow[]>();
  if (packIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({
      packItemId: packContents.packItemId,
      cookieItemId: packContents.cookieItemId,
      quantity: packContents.quantity,
    })
    .from(packContents)
    .where(inArray(packContents.packItemId, packIds));

  if (rows.length === 0) {
    return map;
  }

  const cookieIds = [...new Set(rows.map((row) => row.cookieItemId))];
  const cookies = await db.select().from(menuItems).where(inArray(menuItems.id, cookieIds));
  const cookiesById = new Map(cookies.map((cookie) => [cookie.id, cookie]));

  for (const row of rows) {
    const list = map.get(row.packItemId) ?? [];
    list.push({
      cookieItemId: row.cookieItemId,
      quantity: row.quantity,
      cookie: cookiesById.get(row.cookieItemId) ?? null,
    });
    map.set(row.packItemId, list);
  }
  return map;
}

/**
 * Structural subset of menu item fields the shipping/pack math needs. Full
 * drizzle rows satisfy this, and unit tests can construct lightweight literals.
 */
export type ShippableItemLite = {
  id: string;
  name: string;
  isShippable: boolean;
  available: boolean;
  trackInventory: boolean;
  inventoryQuantity: number;
  weightOunces: number;
  weightMaxOunces: number | null;
  packSize: number | null;
  packTareOunces: number;
  priceCents: number;
};

/** Per-unit weight in ounces used for quotes: max bound when set, always rounded up. */
export function unitWeightOunces(
  item: Pick<ShippableItemLite, "weightOunces" | "weightMaxOunces">,
) {
  const max = item.weightMaxOunces ?? item.weightOunces;
  return Number.isFinite(max) && max > 0 ? max : 0;
}

export type WeightResult = {
  totalOunces: number;
  /** Items whose weight is 0/unknown — cannot quote shipping until fixed. */
  missingWeightNames: string[];
  /** Items flagged pickup-only. */
  unshippableNames: string[];
  /** Items that are packs with no contents and no manual weight. */
  emptyPackNames: string[];
};

/**
 * Derived stock for a pack. Content packs ignore the pack row's own inventory
 * entirely: availability comes from the cookies inside, and the sellable pack
 * count is capped by the tightest tracked cookie. Content-less packs keep
 * row-based semantics. Returns the effective (trackInventory, inventoryQuantity)
 * pair so UI quantity caps and order-time checks share one source of truth.
 */
export function derivePackStock(
  item: Pick<ShippableItemLite, "available" | "trackInventory" | "inventoryQuantity">,
  contents: PackContentRow[],
): { available: boolean; trackInventory: boolean; inventoryQuantity: number } {
  if (contents.length === 0) {
    // Content-less packs keep row-based semantics, same gate the callers
    // apply to singles: available flag AND stock when tracked.
    return {
      available: item.available && (!item.trackInventory || item.inventoryQuantity > 0),
      trackInventory: item.trackInventory,
      inventoryQuantity: item.inventoryQuantity,
    };
  }

  let available = item.available;
  let maxPacks = Number.POSITIVE_INFINITY;
  for (const content of contents) {
    const cookie = content.cookie;
    if (!cookie || !cookie.available) {
      available = false;
      continue;
    }
    if (cookie.trackInventory) {
      if (cookie.inventoryQuantity < content.quantity) {
        available = false;
      }
      if (content.quantity > 0) {
        maxPacks = Math.min(maxPacks, Math.floor(cookie.inventoryQuantity / content.quantity));
      }
    }
  }

  return {
    available,
    trackInventory: Number.isFinite(maxPacks),
    inventoryQuantity: Number.isFinite(maxPacks) ? maxPacks : item.inventoryQuantity,
  };
}

/**
 * Stock matrix: menuItemId -> (locationId -> quantity at that location).
 * Missing entries simply count as zero at that location.
 */
export type LocationStockMatrix = Map<string, Map<string, number>>;

/**
 * Aggregate sellable projection across every location — what menu pages use.
 *
 * Per-location stock is the truth (an order draws from exactly one pool), but
 * the menu is location-agnostic: an item shows as available when ANY location
 * can fulfill it, and the exposed `inventoryQuantity` is the largest amount a
 * single location could fulfill (that's the honest cap for a cart, since one
 * order can never combine two locations' stock). Packs derive per location by
 * the same derivePackStock math over that location's cookie stock, then the
 * best location wins — a pack never mixes cookies from two pools.
 */
export function projectSellableAcrossLocations(
  item: Pick<
    ShippableItemLite,
    "id" | "available" | "trackInventory" | "inventoryQuantity" | "packSize"
  >,
  contents: PackContentRow[],
  stockMatrix: LocationStockMatrix,
  locationIds: string[],
): { available: boolean; trackInventory: boolean; inventoryQuantity: number } {
  const stockAt = (cookieItemId: string, locationId: string) =>
    stockMatrix.get(cookieItemId)?.get(locationId) ?? 0;
  const ownStockAt = (locationId: string) => stockAt(item.id, locationId);

  // Singles and content-less packs sell from their own rows.
  if (contents.length === 0) {
    const quantity = locationIds.reduce(
      (best, locationId) => Math.max(best, ownStockAt(locationId)),
      0,
    );
    return {
      available: item.available && (!item.trackInventory || quantity > 0),
      trackInventory: item.trackInventory,
      inventoryQuantity: item.trackInventory ? quantity : item.inventoryQuantity,
    };
  }

  // Content packs: derive per location, keep the best single-location count.
  let anyTracked = false;
  let best = 0;
  let bestAvailable = false;
  for (const locationId of locationIds) {
    const locatedContents = contents.map((content) => ({
      ...content,
      cookie: content.cookie
        ? {
            ...content.cookie,
            inventoryQuantity: stockAt(content.cookieItemId, locationId),
          }
        : content.cookie,
    }));
    const stock = derivePackStock(
      {
        available: item.available,
        trackInventory: item.trackInventory,
        inventoryQuantity: item.inventoryQuantity,
      },
      locatedContents,
    );
    if (stock.trackInventory) {
      anyTracked = true;
      best = Math.max(best, stock.inventoryQuantity);
      if (stock.inventoryQuantity > 0) {
        bestAvailable = true;
      }
    } else if (stock.available) {
      bestAvailable = true;
    }
  }

  return {
    available: item.available && bestAvailable,
    trackInventory: anyTracked,
    inventoryQuantity: anyTracked ? best : item.inventoryQuantity,
  };
}

/**
 * Compute the shipment weight for a set of cart lines, expanding packs into
 * their contents. Pure over its inputs so it's unit-testable.
 */
export function computeShipmentWeight(
  lines: { item: ShippableItemLite; quantity: number }[],
  contentsByPackId: Map<string, PackContentRow[]>,
): WeightResult {
  let totalOunces = 0;
  const missingWeightNames: string[] = [];
  const unshippableNames: string[] = [];
  const emptyPackNames: string[] = [];

  for (const line of lines) {
    const { item, quantity } = line;
    if (!item.isShippable) {
      unshippableNames.push(item.name);
      continue;
    }

    if (item.packSize) {
      const contents = contentsByPackId.get(item.id);
      if (contents && contents.length > 0) {
        let packOunces = 0;
        let unknown = false;
        for (const content of contents) {
          if (!content.cookie) {
            unknown = true;
            continue;
          }
          const perCookie = unitWeightOunces(content.cookie);
          if (perCookie <= 0) {
            unknown = true;
            continue;
          }
          packOunces += perCookie * content.quantity;
        }
        if (unknown) {
          missingWeightNames.push(item.name);
          continue;
        }
        totalOunces += (packOunces + item.packTareOunces) * quantity;
        continue;
      }

      // Pack with no contents: fall back to a manually set weight on the pack.
      const manual = unitWeightOunces(item);
      if (manual > 0) {
        totalOunces += (manual + item.packTareOunces) * quantity;
        continue;
      }
      emptyPackNames.push(item.name);
      continue;
    }

    const perUnit = unitWeightOunces(item);
    if (perUnit <= 0) {
      missingWeightNames.push(item.name);
      continue;
    }
    totalOunces += perUnit * quantity;
  }

  return {
    totalOunces: Math.ceil(totalOunces),
    missingWeightNames,
    unshippableNames,
    emptyPackNames,
  };
}

/* ------------------------------------------------------------------ */
/* Rate quoting                                                        */
/* ------------------------------------------------------------------ */

export type ShippingAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
};

export type ShippingQuoteOption = {
  title: string;
  amountCents: number;
  currency: string;
  estimatedDays: number | null;
};

type QuoteInput = {
  lines: { item: ShippableItemLite; quantity: number }[];
  addressTo: ShippingAddress;
  /** Skip the edge cache (admin compare + authoritative order-time re-quote). */
  noCache?: boolean;
  /** Admin compare page: override the computed weight entirely. */
  manualTotalOunces?: number;
};

async function fetchShippoRates(input: QuoteInput): Promise<{
  options: ShippingQuoteOption[];
  totalOunces: number;
}> {
  const shippo = await getShippoClient();
  const settings = await getShippingSettings();
  if (!shippo) {
    throw new Error("Shipping is not configured yet.");
  }
  if (!settings.fromAddress) {
    throw new Error(
      "Shipping is not set up: the shop address is missing. Add it under Admin → Shipping.",
    );
  }

  let totalOunces: number;
  if (input.manualTotalOunces && input.manualTotalOunces > 0) {
    totalOunces = Math.ceil(input.manualTotalOunces);
  } else {
    const contentsByPackId = await loadPackContentsByPackIds(
      createDb(),
      input.lines.filter((line) => line.item.packSize).map((line) => line.item.id),
    );
    const weight = computeShipmentWeight(input.lines, contentsByPackId);
    if (weight.unshippableNames.length > 0) {
      throw new Error(`These items can't be shipped: ${weight.unshippableNames.join(", ")}.`);
    }
    if (weight.missingWeightNames.length > 0 || weight.emptyPackNames.length > 0) {
      const names = [...weight.missingWeightNames, ...weight.emptyPackNames];
      throw new Error(`Shipping weight isn't set for: ${names.join(", ")}.`);
    }
    if (weight.totalOunces <= 0) {
      throw new Error("This order has nothing to ship.");
    }
    totalOunces = weight.totalOunces;
  }

  const subtotalCents = input.lines.reduce(
    (sum, line) => sum + line.item.priceCents * line.quantity,
    0,
  );

  const parcel = {
    distanceUnit: "in" as const,
    massUnit: "oz" as const,
    weight: String(totalOunces),
    length: String(settings.box.lengthIn),
    width: String(settings.box.widthIn),
    height: String(settings.box.heightIn),
  };

  const response = await shippo.ratesAtCheckout.create({
    addressFrom: {
      name: settings.fromAddress.name,
      street1: settings.fromAddress.street1,
      street2: settings.fromAddress.street2,
      city: settings.fromAddress.city,
      state: settings.fromAddress.state,
      zip: settings.fromAddress.zip,
      country: settings.fromAddress.country ?? "US",
      validate: true,
    },
    addressTo: {
      name: input.addressTo.name,
      street1: input.addressTo.line1,
      street2: input.addressTo.line2,
      city: input.addressTo.city,
      state: input.addressTo.state,
      zip: input.addressTo.zip,
      country: input.addressTo.country ?? "US",
      validate: true,
    },
    lineItems: [
      {
        title: "Sweet Treats LR order",
        quantity: 1,
        currency: "USD",
        totalPrice: (subtotalCents / 100).toFixed(2),
        // Total shipment weight on a single quantity-1 line: no multiplier
        // ambiguity between "per item" and "per line" semantics.
        weight: String(totalOunces),
        weightUnit: "oz" as const,
      },
    ],
    parcel,
  });

  const options: ShippingQuoteOption[] = (response.results ?? [])
    .filter((rate) => rate.amount)
    .map((rate) => ({
      title: rate.title ?? "",
      amountCents: Math.round(Number(rate.amount ?? "0") * 100),
      currency: rate.currency ?? "USD",
      estimatedDays: rate.estimatedDays ?? null,
    }));

  return { options, totalOunces };
}

function quoteCacheKey(
  lines: { item: ShippableItemLite; quantity: number }[],
  addressTo: ShippingAddress,
  totalOunces: number,
  settings: ShippingSettings,
): string {
  // Rates zone on origin/destination ZIPs, not street addresses, so the key
  // stays low-cardinality and hits often. Box dimensions and the origin
  // affect the quote, so they belong in the key — editing them in the admin
  // settings invalidates cached entries naturally.
  const ids = lines
    .map((line) => `${line.item.id}:${line.quantity}`)
    .sort()
    .join(",");
  const originZip = settings.fromAddress?.zip ?? "unset";
  const { lengthIn, widthIn, heightIn } = settings.box;
  return `shippo-quote:v2:${totalOunces}oz:${originZip}:${addressTo.zip}:${lengthIn}x${widthIn}x${heightIn}:${ids}`;
}

/**
 * Public checkout quote: edge-cached for a short window so tweaking an
 * address doesn't re-bill Shippo's API on every keystroke.
 */
export async function quoteShippingRates(input: QuoteInput) {
  if (input.noCache || input.manualTotalOunces || typeof caches === "undefined") {
    return fetchShippoRates(input);
  }

  const cache = (caches as unknown as { default: Cache }).default;
  // Weight is needed for the key, so compute it first (cheap, DB-only).
  const db = createDb();
  const contentsByPackId = await loadPackContentsByPackIds(
    db,
    input.lines.filter((line) => line.item.packSize).map((line) => line.item.id),
  );
  const weight = computeShipmentWeight(input.lines, contentsByPackId);
  if (
    weight.unshippableNames.length > 0 ||
    weight.missingWeightNames.length > 0 ||
    weight.emptyPackNames.length > 0 ||
    weight.totalOunces <= 0
  ) {
    // Surface the same error the uncached path would, without caching it.
    return fetchShippoRates(input);
  }
  const key = quoteCacheKey(
    input.lines,
    input.addressTo,
    weight.totalOunces,
    await getShippingSettings(),
  );
  const cacheRequest = new Request(`https://internal.sweettreats/${encodeURIComponent(key)}`);

  const cached = await cache.match(cacheRequest);
  if (cached) {
    const body = (await cached.json()) as Awaited<ReturnType<typeof fetchShippoRates>>;
    return body;
  }

  const result = await fetchShippoRates(input);
  const response = new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json", "cache-control": "public, s-maxage=600" },
  });
  try {
    await cache.put(cacheRequest, response);
  } catch {
    // Cache failures never break a quote.
  }
  return result;
}

/**
 * Authoritative order-time pricing: re-quote Shippo fresh (never cached) and
 * match the chosen option by title. The amount charged is whatever Shippo
 * returns now — a tampered "amount" from the browser is impossible.
 */
export async function resolveShippingOption(
  input: Omit<QuoteInput, "noCache">,
  serviceTitle: string,
): Promise<{ serviceName: string; shippingCents: number }> {
  const fresh = await fetchShippoRates({ ...input, noCache: true });
  const normalized = serviceTitle.trim().toLowerCase();
  const match = fresh.options.find((option) => option.title.toLowerCase() === normalized) ?? null;
  if (!match) {
    throw new Error(
      "That shipping option is no longer available. Go back and pick a different shipping speed.",
    );
  }
  return { serviceName: match.title, shippingCents: match.amountCents };
}

/**
 * Idempotent bootstrap: /live-rates only returns options defined by a Shippo
 * Service Group. Create a sensible default one if none exists.
 */
export async function ensureShippingServiceGroup(): Promise<{
  ok: boolean;
  existed: boolean;
  message: string;
}> {
  const shippo = await getShippoClient();
  if (!shippo) {
    return { ok: false, existed: false, message: "Shipping is not configured (missing API key)." };
  }

  try {
    const existing = await shippo.serviceGroups.list({});
    // Only a LIVE_RATE group powers /live-rates; an existing FLAT_RATE or
    // FREE_SHIPPING group isn't sufficient, so check the type specifically.
    const groups = Array.isArray(existing) ? existing : [];
    const hasLiveRateGroup = groups.some((group) => {
      const groupType = (group as { type?: unknown }).type;
      return String(groupType).toUpperCase() === "LIVE_RATE";
    });
    if (hasLiveRateGroup) {
      return {
        ok: true,
        existed: true,
        message: "A live-rate service group already exists in Shippo.",
      };
    }

    await shippo.serviceGroups.create({
      name: "Standard Shipping",
      description: "USPS live rates offered at Sweet Treats LR checkout",
      type: "LIVE_RATE",
      serviceLevels: [
        { serviceLevelToken: "usps_ground_advantage" },
        { serviceLevelToken: "usps_priority" },
        { serviceLevelToken: "usps_priority_express" },
      ],
    });
    logger.info("shippo.service_group_created");
    return {
      ok: true,
      existed: false,
      message: "Created a 'Standard Shipping' live-rate service group with USPS services.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("shippo.service_group_setup_failed", { error: message });
    return {
      ok: false,
      existed: false,
      message: `Could not create the service group: ${message}. Create one in the Shippo dashboard (Settings → Service Groups, type "Live Rates", add USPS Ground Advantage / Priority / Priority Express).`,
    };
  }
}
