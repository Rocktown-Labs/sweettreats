import { createDb } from "@sweettreats/db";
import { emailOutbox } from "@sweettreats/db/schema/index";
import { eq } from "drizzle-orm";

import { handleOutboxEvent } from "../lib/email-events";
import { markOutboxFailed, markOutboxRetry, markOutboxSent } from "../lib/outbox";
import { logger } from "../lib/logger";

/**
 * Cloudflare Queues consumer for the email outbox. Each message references an
 * outbox row by id; the handler re-loads it and dispatches by event.
 *
 * Delivery semantics: a message that throws is retried up to the consumer's
 * max_retries; after that it is acked and the row is marked failed. The
 * hourly cron drain re-enqueues rows that are still pending, so transient
 * infrastructure failures self-heal and only truly bad payloads dead-end in
 * "failed" with the error recorded.
 */

const MAX_ATTEMPTS = 10;

export async function handleEmailQueue(batch: QueueBatch, _env: unknown): Promise<void> {
  const db = createDb();

  for (const message of batch.messages) {
    let outboxId = "";
    try {
      const body = JSON.parse(String(message.body)) as { outboxId?: string };
      outboxId = String(body.outboxId ?? "");
      if (!outboxId) {
        logger.error("outbox.consumer_missing_id", {});
        message.ack();
        continue;
      }

      const row = await db.query.emailOutbox.findFirst({
        where: eq(emailOutbox.id, outboxId),
      });

      if (!row) {
        // Deleted (e.g. test fixture) — nothing to do.
        message.ack();
        continue;
      }
      if (row.status === "sent") {
        // Already handled — idempotent replay.
        message.ack();
        continue;
      }

      await handleOutboxEvent(row.event, JSON.parse(row.payload) as Record<string, unknown>);
      await markOutboxSent(db, outboxId);
      message.ack();
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error("outbox.consumer_failed", { outboxId, error });

      const row = outboxId
        ? await db.query.emailOutbox.findFirst({
            where: eq(emailOutbox.id, outboxId),
          })
        : null;
      const attempts = row?.attempts ?? 0;

      if (attempts + 1 >= MAX_ATTEMPTS) {
        await markOutboxFailed(db, outboxId, error).catch(() => {});
        message.ack();
        continue;
      }
      await markOutboxRetry(db, outboxId, error).catch(() => {});
      if (message.attempts < 3) {
        // Let Queues retry with its own backoff first.
        message.retry();
      } else {
        // Queues retries exhausted: ack so the row rests until the cron
        // drain picks it up again after its backoff window.
        message.ack();
      }
    }
  }
}

// Minimal structural type so the worker compiles without
// @cloudflare/workers-types global collisions.
type QueueMessage = {
  body: string | unknown;
  attempts: number;
  ack: () => void;
  retry: () => void;
};
type QueueBatch = { messages: QueueMessage[] };
