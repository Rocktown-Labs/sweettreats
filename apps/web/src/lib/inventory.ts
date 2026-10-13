import { createDb } from "@sweettreats/db";
import { menuItems, orderItems } from "@sweettreats/db/schema/index";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Inventory helpers shared by checkout and the Stripe webhook.
 *
 * Reservation is a conditional UPDATE (`WHERE available AND quantity >= n`),
 * which is race-safe on D1. Release must mirror reservation exactly:
 * only tracked items ever had stock taken, and availability is only restored
 * from the sold-out state — an admin's deliberate `available = false` is
 * never overwritten by a release.
 */

type ReleaseLine = { itemId: string; quantity: number };

async function releaseLines(
  db: ReturnType<typeof createDb>,
  lines: ReleaseLine[],
): Promise<number> {
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

  if (released > 0) {
    logger.info("inventory.released", { units: released });
  }
  return released;
}

export async function releaseInventoryForOrder(orderId: string): Promise<number> {
  const db = createDb();
  // Only items that track inventory were ever decremented; releasing
  // untracked items would add phantom stock.
  const rows = await db
    .select({
      menuItemId: orderItems.menuItemId,
      quantity: orderItems.quantity,
      trackInventory: menuItems.trackInventory,
    })
    .from(orderItems)
    .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
    .where(eq(orderItems.orderId, orderId));

  const tracked: ReleaseLine[] = [];
  const byId = new Map<string, number>();
  for (const row of rows) {
    if (!row.menuItemId || !row.trackInventory) {
      continue;
    }
    const key = row.menuItemId;
    byId.set(key, (byId.get(key) ?? 0) + row.quantity);
  }
  for (const [itemId, quantity] of byId) {
    tracked.push({ itemId, quantity });
  }

  if (tracked.length === 0) {
    return 0;
  }
  return releaseLines(db, tracked);
}

/**
 * Release in-memory reservations when an order failed before (or right
 * after) its rows were persisted. `reservedLines` only ever contains lines
 * that were actually reserved (tracked items), so no extra filtering applies.
 */
export async function releaseReservedLines(
  db: ReturnType<typeof createDb>,
  lines: { itemId: string | null; quantity: number }[],
): Promise<number> {
  const valid = lines.filter(
    (line): line is ReleaseLine =>
      line.itemId !== null && line.quantity > 0 && Number.isFinite(line.quantity),
  );
  if (valid.length === 0) {
    return 0;
  }
  return releaseLines(db, valid);
}
