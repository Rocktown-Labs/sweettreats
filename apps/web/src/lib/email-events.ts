import { createDb } from "@sweettreats/db";
import { cartSnapshots, user } from "@sweettreats/db/schema/index";
import { eq } from "drizzle-orm";
import { env } from "@sweettreats/env/server";
import { sendAbandonedCartEmail, sendWelcomeEmail, type SendEmailResult } from "@sweettreats/email";

import { sendOrderNotifications } from "./order-emails";
import { logger } from "./logger";

/**
 * Event dispatch for the email outbox. Each handler re-loads authoritative
 * data from the DB by id — payloads only carry references.
 */

function resendKey(): string {
  const processEnv = typeof process === "undefined" ? undefined : process.env.RESEND_API_KEY;
  return String((env as Record<string, unknown>).RESEND_API_KEY ?? processEnv ?? "");
}

export async function handleOutboxEvent(
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = createDb();
  const apiKey = resendKey();

  switch (event) {
    case "order.confirmed": {
      const orderId = String(payload.orderId ?? "");
      if (!orderId) {
        throw new Error("order.confirmed payload missing orderId");
      }
      await sendOrderNotifications(orderId);
      return;
    }

    case "welcome": {
      const userId = String(payload.userId ?? "");
      if (!userId) {
        throw new Error("welcome payload missing userId");
      }
      const account = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { name: true, email: true },
      });
      if (!account) {
        // Account deleted before the email drained — nothing to send.
        return;
      }
      const result: SendEmailResult = await sendWelcomeEmail(
        { name: account.name },
        { to: account.email, apiKey },
      );
      logger.info("outbox.welcome_sent", { userId, success: result.success });
      return;
    }

    case "order.abandoned_cart": {
      const cartId = String(payload.cartId ?? "");
      if (!cartId) {
        throw new Error("order.abandoned_cart payload missing cartId");
      }
      const snapshot = await db.query.cartSnapshots.findFirst({
        where: eq(cartSnapshots.id, cartId),
      });
      if (!snapshot || !snapshot.email) {
        return;
      }
      if (snapshot.recoveredAt) {
        // They came back before the email drained — don't send it.
        return;
      }
      let items: { name: string; quantity: number }[] = [];
      try {
        items = JSON.parse(snapshot.lines);
      } catch {
        items = [];
      }
      const result = await sendAbandonedCartEmail(
        {
          name: snapshot.email.split("@")[0] || "Friend",
          items,
          subtotalCents: snapshot.subtotalCents,
        },
        { to: snapshot.email, cartId, apiKey },
      );
      logger.info("outbox.abandoned_cart_sent", { cartId, success: result.success });
      return;
    }

    case "order.shipped": {
      const orderId = String(payload.orderId ?? "");
      if (!orderId) {
        throw new Error("order.shipped payload missing orderId");
      }
      await sendOrderNotifications(orderId); // reuses the same email pipeline for now
      return;
    }

    default:
      logger.warn("outbox.unknown_event", { event });
  }
}
