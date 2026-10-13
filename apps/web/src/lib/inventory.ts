import { createDb } from "@sweettreats/db";
import { menuItems, orderItems } from "@sweettreats/db/schema/index";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Inventory helpers shared by checkout and the Stripe webhook.
 *
 * Reservation is a conditional UPDATE (`WHERE available AND quantity >= n`),
 * which is race-safe on D1. Release is additive and only re-enables the item
 * when stock actually comes back.
 */

export async function releaseInventoryForOrder(orderId: string): Promise<number> {
  const db = createDb();
  const lines = await db
    .select({ menuItemId: orderItems.menuItemId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  return releaseReservedLines(
    db,
    lines.map((line) => ({
      itemId: line.menuItemId,
      quantity: line.quantity,
    })),
  );
}

/**
 * Release in-memory reservations when an order failed before its rows were
 * persisted (order_items may not exist yet, so the order-based variant
 * would find nothing to release).
 */
export async function releaseReservedLines(
  db: ReturnType<typeof createDb>,
  lines: { itemId: string | null; quantity: number }[],
): Promise<number> {
  let released = 0;
  for (const line of lines) {
    if (!line.itemId) {
      continue;
    }
    await db
      .update(menuItems)
      .set({
        inventoryQuantity: sql`${menuItems.inventoryQuantity} + ${line.quantity}`,
        // Only flip availability back on if the release brought stock above
        // zero; the item may have been disabled by an admin in the meantime.
        available: sql`CASE WHEN ${menuItems.inventoryQuantity} + ${line.quantity} > 0 THEN 1 ELSE 0 END`,
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
