import { createDb } from "@sweettreats/db";
import { emailOutbox } from "@sweettreats/db/schema/index";
import { eq, and, lt, sql } from "drizzle-orm";
import { env } from "@sweettreats/env/server";

import { logger } from "./logger";

/**
 * Transactional outbox for every notification email.
 *
 * Reliability model:
 * 1. The producer writes an outbox row in the same db.batch as the business
 *    event (or immediately after, for webhook-triggered events), so a crash
 *    between "order created" and "email queued" can never lose the intent.
 * 2. The row is then enqueued to the Cloudflare EMAIL_QUEUE — a fast-path
 *    consumer drains it within seconds.
 * 3. The hourly cron re-enqueues rows still pending after 10 minutes, so a
 *    failed enqueue or a dead consumer self-heals.
 *
 * Handlers always re-load authoritative data from the DB by id; the payload
 * only carries references, never content — so emails stay correct even if
 * rows change between enqueue and send.
 */

type Db = ReturnType<typeof createDb>;

export type OutboxEvent = "welcome" | "order.confirmed" | "order.abandoned_cart";

export async function enqueueEmail(
  db: Db,
  event: OutboxEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const id = crypto.randomUUID();
  await db.insert(emailOutbox).values({
    id,
    event,
    payload: JSON.stringify(payload),
  });

  // Fast path: hand to the queue consumer. Failures are fine — the cron
  // sweep re-enqueues anything still pending.
  await queueSend({ outboxId: id }).catch((err) => {
    logger.warn("outbox.enqueue_failed", {
      outboxId: id,
      event,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export async function queueSend(body: Record<string, unknown>): Promise<void> {
  const queue = (env as Record<string, unknown>).EMAIL_QUEUE as
    | { send: (message: string) => Promise<void> }
    | undefined;
  if (!queue) {
    throw new Error("EMAIL_QUEUE binding is not configured.");
  }
  await queue.send(JSON.stringify(body));
}

/** Mark an outbox row sent (queue consumer success). */
export async function markOutboxSent(db: Db, outboxId: string): Promise<void> {
  await db
    .update(emailOutbox)
    .set({ status: "sent", updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(emailOutbox.id, outboxId));
}

/** Record a delivery attempt failure; back off availableAt by 5 minutes. */
export async function markOutboxRetry(db: Db, outboxId: string, error: string): Promise<void> {
  await db
    .update(emailOutbox)
    .set({
      attempts: sql`${emailOutbox.attempts} + 1`,
      lastError: error.slice(0, 500),
      availableAt: sql`datetime('now', '+5 minutes')`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(emailOutbox.id, outboxId));
}

/** Give up on a row after the max attempts; stays visible for debugging. */
export async function markOutboxFailed(db: Db, outboxId: string, error: string): Promise<void> {
  await db
    .update(emailOutbox)
    .set({
      status: "failed",
      attempts: sql`${emailOutbox.attempts} + 1`,
      lastError: error.slice(0, 500),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(emailOutbox.id, outboxId));
}

/**
 * Cron drain: re-enqueue rows that are still pending past their
 * availability window (crashed enqueues, dead consumers, exhausted
 * queue retries).
 */
export async function reenqueueStaleOutboxRows(): Promise<number> {
  const db = createDb();
  const stale = await db
    .select({ id: emailOutbox.id, event: emailOutbox.event, attempts: emailOutbox.attempts })
    .from(emailOutbox)
    .where(
      and(
        eq(emailOutbox.status, "pending"),
        lt(emailOutbox.availableAt, sql`datetime('now', '-10 minutes')`),
      ),
    )
    .limit(50);

  let count = 0;
  for (const row of stale) {
    if (row.attempts >= 10) {
      await markOutboxFailed(db, row.id, "exhausted retries via cron drain");
      continue;
    }
    await queueSend({ outboxId: row.id })
      .then(async () => {
        count += 1;
      })
      .catch((err) => {
        logger.warn("outbox.cron_reenqueue_failed", {
          outboxId: row.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  if (count > 0) {
    logger.info("outbox.cron_reenqueued", { count });
  }
  return count;
}
