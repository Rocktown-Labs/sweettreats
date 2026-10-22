import { createDb } from "@sweettreats/db";
import {
  menuItemLocationInventory,
  menuItems,
  orderItems,
  orders,
} from "@sweettreats/db/schema/index";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Inventory helpers shared by checkout and the Stripe webhook.
 *
 * Stock lives in per-location rows (`menu_item_location_inventory`): each
 * pickup location has its own case, orders decrement exactly one location's
 * pool (recorded on `orders.inventory_location_id`), and releases credit that
 * same pool. Legacy orders placed before the per-location migration have a
 * null `inventory_location_id` — those reserve/ release against the item's
 * global row, so old pending orders keep behaving exactly as they did.
 *
 * Reservation is a conditional UPDATE (`WHERE available AND quantity >= n`),
 * which is race-safe on D1. Release mirrors it with a single upsert.
 */

type ReleaseLine = { itemId: string; quantity: number };

type Db = ReturnType<typeof createDb>;

async function releaseLinesGlobal(db: Db, lines: ReleaseLine[]): Promise<number> {
  let released = 0;
  for (const line of lines) {
    await db
      .update(menuItems)
      .set({
        inventoryQuantity: sql`${menuItems.inventoryQuantity} + ${line.quantity}`,
        // Only restore availability from the sold-out state (stock was
        // exactly zero, i.e. reservations emptied it). An item disabled by an
        // admin keeps inventory > 0 and stays disabled.
        available: sql`CASE WHEN ${menuItems.inventoryQuantity} = 0 AND ${menuItems.inventoryQuantity} + ${line.quantity} > 0 THEN 1 ELSE ${menuItems.available} END`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(menuItems.id, line.itemId));
    released += line.quantity;
  }
  return released;
}

/**
 * Credit stock back to one location's pool. A single INSERT .. ON CONFLICT
 * DO UPDATE is race-safe and also repairs a missing row (e.g. the location
 * was created before this item existed).
 */
async function releaseLinesAtLocation(
  db: Db,
  locationId: string,
  lines: ReleaseLine[],
): Promise<number> {
  let released = 0;
  for (const line of lines) {
    if (line.quantity <= 0) {
      continue;
    }
    await db
      .insert(menuItemLocationInventory)
      .values({
        id: `${line.itemId}:${locationId}`,
        menuItemId: line.itemId,
        pickupLocationId: locationId,
        quantity: line.quantity,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: [menuItemLocationInventory.menuItemId, menuItemLocationInventory.pickupLocationId],
        set: {
          quantity: sql`${menuItemLocationInventory.quantity} + ${line.quantity}`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
    released += line.quantity;
  }
  return released;
}

/** Collect the per-item units an order reserved, expanding pack snapshots. */
async function collectReservedLines(db: Db, orderId: string): Promise<ReleaseLine[] | null> {
  const rows = await db
    .select({
      menuItemId: orderItems.menuItemId,
      quantity: orderItems.quantity,
      trackInventory: menuItems.trackInventory,
      packSize: menuItems.packSize,
      reservationSnapshot: orderItems.reservationSnapshot,
    })
    .from(orderItems)
    // Left join: order_items.menuItemId is ON DELETE SET NULL, and the admin
    // can hard-delete products. A deleted pack must still release its
    // contents — the reservation snapshot carries its own targets.
    .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
    .where(eq(orderItems.orderId, orderId));

  const byId = new Map<string, number>();
  const addUnits = (units: { menuItemId: string | null; quantity: number }[]) => {
    for (const unit of units) {
      if (!unit.menuItemId || unit.quantity <= 0) {
        continue;
      }
      byId.set(unit.menuItemId, (byId.get(unit.menuItemId) ?? 0) + unit.quantity);
    }
  };

  for (const row of rows) {
    // Prefer the reservation snapshot: packs expand into cookies, and the
    // snapshot is immune to recipe edits made after the order was placed.
    const snapshot = parseReservationSnapshot(row.reservationSnapshot);
    if (snapshot) {
      addUnits(snapshot);
      continue;
    }
    // Legacy rows and non-pack items: release the row itself when the item
    // tracks inventory. Pack rows with a null snapshot reserved nothing
    // (content packs draw from their cookies, untracked packs don't count),
    // so releasing them would add phantom stock.
    if (row.menuItemId && row.trackInventory && !row.packSize) {
      addUnits([{ menuItemId: row.menuItemId, quantity: row.quantity }]);
    }
  }

  if (byId.size === 0) {
    return null;
  }
  return [...byId.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
}

export async function releaseInventoryForOrder(orderId: string): Promise<number> {
  const db = createDb();

  const order = await db.query.orders
    .findFirst({
      where: eq(orders.id, orderId),
      columns: { id: true, inventoryLocationId: true },
    })
    .catch(() => null);
  const lines = await collectReservedLines(db, orderId);
  if (!lines) {
    return 0;
  }

  // Per-location orders credit the pool they decremented; legacy orders
  // (null location) fall back to the pre-migration global-row behavior.
  const released =
    order?.inventoryLocationId != null
      ? await releaseLinesAtLocation(db, order.inventoryLocationId, lines)
      : await releaseLinesGlobal(db, lines);

  if (released > 0) {
    logger.info("inventory.released", { units: released, orderId });
  }
  return released;
}

/** Snapshot format: [{"menuItemId":"...","quantity":3}, ...]. Exported for tests. */
export function parseReservationSnapshot(
  snapshot: string | null,
): { menuItemId: string | null; quantity: number }[] | null {
  if (!snapshot) {
    return null;
  }
  try {
    const parsed = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed
      .filter(
        (entry): entry is { menuItemId: string; quantity: number } =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as Record<string, unknown>).menuItemId === "string" &&
          typeof (entry as Record<string, unknown>).quantity === "number",
      )
      .map((entry) => ({ menuItemId: entry.menuItemId, quantity: entry.quantity }));
  } catch {
    return null;
  }
}

/**
 * Release in-memory reservations when an order failed before (or right
 * after) its rows were persisted. `reservedLines` only ever contains lines
 * that were actually reserved (tracked items), so no extra filtering applies.
 */
export async function releaseReservedLines(
  db: Db,
  lines: { itemId: string | null; quantity: number }[],
  locationId?: string | null,
): Promise<number> {
  const valid = lines.filter(
    (line): line is ReleaseLine =>
      line.itemId !== null && line.quantity > 0 && Number.isFinite(line.quantity),
  );
  if (valid.length === 0) {
    return 0;
  }

  const released =
    locationId != null
      ? await releaseLinesAtLocation(db, locationId, valid)
      : await releaseLinesGlobal(db, valid);

  if (released > 0) {
    logger.info("inventory.released", { units: released, inFlight: true });
  }
  return released;
}
