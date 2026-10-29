import { createDb } from "@sweettreats/db";
import { cartSnapshots, orders } from "@sweettreats/db/schema/index";
import { and, eq, lt, sql } from "drizzle-orm";

import { releaseInventoryForOrder } from "../lib/inventory";
import { reenqueueStaleOutboxRows, enqueueEmail } from "../lib/outbox";
import { logger } from "../lib/logger";
import { stripeAmountMatches } from "../lib/stripe-amounts";
import { getStripeClient } from "../lib/stripe-client";

/**
 * Hourly cron sweep. Three jobs, all designed to be idempotent and safe to
 * run any number of times:
 *
 * 1. Cancel stale `pending` orders (>24h old) and release their reserved
 *    stock. Covers crashed checkouts and missed Stripe expiry webhooks. With
 *    Stripe configured, a stale order's session is re-checked first — a
 *    session that actually got paid is never cancelled (we wait for the
 *    webhook; if webhooks are truly broken that's visible in Stripe's
 *    dashboard rather than silently mis-cancelled).
 * 2. Re-enqueue outbox rows still pending past their backoff window
 *    (self-heal for missed enqueues and dead consumers).
 * 3. Abandoned carts: snapshots whose last ping is 24-48h old, with a known
 *    contact email, no abandonment email yet, and no recovery — enqueue
 *    exactly one win-back email.
 * 4. Prune expired rate-limit buckets.
 */

const STALE_ORDER_HOURS = 24;
const ABANDON_AFTER_HOURS = 24;
const ABANDON_BEFORE_HOURS = 72;

export async function handleScheduled(_event: unknown, _env: unknown): Promise<void> {
  await Promise.allSettled([
    sweepStalePendingOrders(),
    reenqueueStaleOutboxRows(),
    sweepAbandonedCarts(),
    pruneRateLimits(),
  ]);
}

async function sweepStalePendingOrders(): Promise<void> {
  const db = createDb();
  const cutoff = sql`datetime('now', '-${STALE_ORDER_HOURS} hours')`;

  const stale = await db
    .select({
      id: orders.id,
      stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
      totalCents: orders.totalCents,
      subtotalCents: orders.subtotalCents,
      shippingCents: orders.shippingCents,
      handlingCents: orders.handlingCents,
    })
    .from(orders)
    .where(and(eq(orders.status, "pending"), lt(orders.createdAt, cutoff)))
    .limit(25);

  if (stale.length === 0) {
    return;
  }

  const stripe = await getStripeClient();
  let cancelled = 0;

  for (const order of stale) {
    // If the session was actually paid, confirm it — the webhook may have
    // been missed (endpoint down, event dropped). Only the webhook or this
    // sweep may confirm; both require proof from Stripe.
    if (stripe && order.stripeCheckoutSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
        if (session.payment_status === "paid" && !stripeAmountMatches(order, session)) {
          logger.error("cron.amount_mismatch", {
            orderId: order.id,
            charged: session.amount_total ?? 0,
          });
          continue;
        }
        if (session.payment_status === "paid") {
          const confirmed = await db
            .update(orders)
            .set({
              status: "confirmed",
              paymentStatus: "paid",
              checkoutProvider: "stripe",
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
            .returning({ id: orders.id });
          if (confirmed.length > 0) {
            await enqueueEmail(createDb(), "order.confirmed", { orderId: order.id }).catch(
              () => {},
            );
            logger.warn("cron.confirmed_paid_order_missing_webhook", { orderId: order.id });
          }
          continue;
        }
      } catch (err) {
        logger.error("cron.session_check_failed", {
          orderId: order.id,
          error: err instanceof Error ? err.message : String(err),
        });
        // Could not verify — safer to wait another hour than cancel a
        // possibly-paid order.
        continue;
      }
    }

    const updated = await db
      .update(orders)
      .set({
        status: "cancelled",
        paymentStatus: "abandoned",
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
      .returning({ id: orders.id });

    if (updated.length > 0) {
      await releaseInventoryForOrder(order.id);
      cancelled += 1;
    }
  }

  if (cancelled > 0) {
    logger.info("cron.stale_orders_cancelled", { cancelled });
  }
}

async function sweepAbandonedCarts(): Promise<void> {
  const db = createDb();
  const after = sql`datetime('now', '-${ABANDON_AFTER_HOURS} hours')`;
  const before = sql`datetime('now', '-${ABANDON_BEFORE_HOURS} hours')`;

  // Carts that went quiet for a day, with a contactable email, never emailed,
  // never recovered.
  const candidates = await db
    .select({ id: cartSnapshots.id })
    .from(cartSnapshots)
    .where(
      and(
        lt(cartSnapshots.lastSeenAt, after),
        sql`${cartSnapshots.lastSeenAt} > ${before}`,
        sql`${cartSnapshots.email} != ''`,
        sql`${cartSnapshots.recoveredAt} IS NULL`,
        sql`${cartSnapshots.abandonedEmailSentAt} IS NULL`,
      ),
    )
    .limit(25);

  for (const candidate of candidates) {
    // Claim first (idempotent against overlapping cron runs), then enqueue.
    const claimed = await db
      .update(cartSnapshots)
      .set({
        abandonedEmailSentAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(cartSnapshots.id, candidate.id),
          sql`${cartSnapshots.abandonedEmailSentAt} IS NULL`,
          sql`${cartSnapshots.recoveredAt} IS NULL`,
        ),
      )
      .returning({ id: cartSnapshots.id });

    if (claimed.length === 0) {
      continue;
    }

    // The queue consumer dispatches by outbox id; sending `{event, cartId}`
    // directly made the consumer ack the message without sending anything.
    // Enqueue a real outbox row, and release the claim if the insert fails
    // so the next cron pass can retry instead of silently dropping the email.
    await enqueueEmail(db, "order.abandoned_cart", { cartId: candidate.id }).catch(async (err) => {
      await db
        .update(cartSnapshots)
        .set({ abandonedEmailSentAt: null, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(cartSnapshots.id, candidate.id))
        .catch(() => {});
      logger.warn("cron.abandoned_enqueue_failed", {
        cartId: candidate.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

async function pruneRateLimits(): Promise<void> {
  const db = createDb();
  await db.run(sql`DELETE FROM rate_limits WHERE expires_at < unixepoch()`).catch(() => {});
}
