import { createFileRoute } from "@tanstack/react-router";
import { createDb } from "@sweettreats/db";
import { orders } from "@sweettreats/db/schema/index";
import { and, eq, ne, sql } from "drizzle-orm";
import { enqueueEmail } from "@/lib/outbox";
import { INTEGRATION_KEY_IDS, resolveIntegrationKey } from "@/lib/secure-settings";
import { logger } from "@/lib/logger";
import { publishAdminEvent } from "@/realtime/publish";

/**
 * Shippo tracking webhook (event: track_updated).
 *
 * Fail-closed verification via the self-generated URL token from the
 * Integrations sheet: lauryan invents a long random string, pastes it in the
 * sheet, and appends ?token=… to this URL when creating the webhook in the
 * Shippo portal (Shippo's documented auth option — HMAC requires a support
 * engagement with them). Every delivery without the exact token is rejected,
 * and no token configured means nothing gets through.
 *
 * The webhook updates orders.shipping_status on genuine transitions only
 * (Shippo redelivers), marks the order completed when the carrier reports
 * DELIVERED, queues the customer's "delivered" email exactly once, and pings
 * the admin realtime channel so open tabs refresh.
 */
export const Route = createFileRoute("/api/shippo/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedToken = await resolveIntegrationKey(INTEGRATION_KEY_IDS.shippoWebhookToken);
        if (!expectedToken) {
          logger.error("shippo.webhook_rejected_unconfigured");
          return new Response("Webhook not verified", { status: 401 });
        }
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (token !== expectedToken) {
          logger.warn("shippo.webhook_rejected_bad_token");
          return new Response("Webhook not verified", { status: 401 });
        }

        let payload: {
          event?: string;
          test?: boolean;
          data?: {
            tracking_number?: string;
            carrier?: string;
            tracking_status?: { status?: string; status_details?: string };
          };
        };
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // Only tracking updates are wired up; other Shippo events are acked.
        if (payload?.event !== "track_updated") {
          return new Response("OK", { status: 200 });
        }

        const trackingNumber = String(payload.data?.tracking_number ?? "");
        const status = String(payload.data?.tracking_status?.status ?? "").toUpperCase();
        if (!trackingNumber || !status) {
          return new Response("OK", { status: 200 });
        }

        const db = createDb();
        // Transition-only update: duplicates redelivered by Shippo are no-ops,
        // so the delivered email fires exactly once. Cancelled orders are left
        // alone — a delivered scan can't resurrect a refunded order.
        const updated = await db
          .update(orders)
          .set({
            shippingStatus: status,
            ...(status === "DELIVERED" ? { status: "completed" as const } : {}),
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(orders.trackingNumber, trackingNumber),
              eq(orders.fulfillmentType, "shipping"),
              ne(orders.shippingStatus, status),
              ne(orders.status, "cancelled"),
            ),
          )
          .returning({ id: orders.id, orderNumber: orders.orderNumber });

        if (updated.length === 0) {
          return new Response("OK", { status: 200 });
        }

        const { id: orderId, orderNumber } = updated[0];
        logger.info("shippo.webhook_tracking_updated", { orderId, trackingNumber, status });

        if (status === "DELIVERED") {
          await enqueueEmail(db, "order.delivered", { orderId }).catch(() => {});
        }
        publishAdminEvent({
          type: "order.updated",
          orderId,
          orderNumber,
          status: status === "DELIVERED" ? "completed" : undefined,
        });

        return new Response("OK", { status: 200 });
      },
    },
  },
});
