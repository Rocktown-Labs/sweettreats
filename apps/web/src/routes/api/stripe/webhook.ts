import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createDb } from "@sweettreats/db";
import { orders } from "@sweettreats/db/schema/index";
import { eq, and, ne, sql } from "drizzle-orm";
import { sendOrderNotifications } from "@/lib/order-emails";
import { releaseInventoryForOrder } from "@/lib/inventory";
import { logger } from "@/lib/logger";
import { env } from "@sweettreats/env/server";

function readEnv(key: string): string {
  const processEnv = typeof process === "undefined" ? undefined : process.env[key];
  return String((env as Record<string, unknown>)[key] ?? processEnv ?? "");
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        const stripeSecretKey = readEnv("STRIPE_SECRET_KEY");
        const webhookSecret = readEnv("STRIPE_WEBHOOK_SECRET");

        // Fail closed: if Stripe isn't configured, or the signing secret or
        // signature is missing, never accept the event. There is no
        // unsigned-parsing fallback — that would let anyone forge payments.
        if (!stripeSecretKey || !webhookSecret || !signature) {
          logger.error("stripe.webhook_rejected_unverified", {
            hasSecretKey: Boolean(stripeSecretKey),
            hasWebhookSecret: Boolean(webhookSecret),
            hasSignature: Boolean(signature),
          });
          return new Response("Webhook not verified", { status: 400 });
        }

        const stripe = new Stripe(stripeSecretKey);
        const body = await request.text();

        let event: Stripe.Event;
        try {
          event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err) {
          logger.error("stripe.webhook_signature_failed", {
            error: err instanceof Error ? err.message : String(err),
          });
          return new Response("Invalid signature", { status: 400 });
        }

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;
          if (!orderId) {
            logger.warn("stripe.webhook_missing_order_id", { sessionId: session.id });
            return new Response("OK", { status: 200 });
          }

          const db = createDb();
          const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
          });

          if (!order) {
            logger.warn("stripe.webhook_order_not_found", { orderId });
            return new Response("OK", { status: 200 });
          }

          // Idempotency: duplicate deliveries of the same event must be a
          // no-op, not a second confirmation + second round of emails.
          if (order.paymentStatus === "paid" && order.status !== "pending") {
            logger.info("stripe.webhook_already_paid", { orderId });
            return new Response("OK", { status: 200 });
          }

          // Trust Stripe's payment state, and confirm the amount actually
          // charged matches the order before releasing goods.
          if (session.payment_status !== "paid") {
            logger.warn("stripe.webhook_unpaid_session", {
              orderId,
              paymentStatus: session.payment_status,
            });
            return new Response("OK", { status: 200 });
          }
          const amountTotal = session.amount_total ?? 0;
          if (amountTotal !== order.subtotalCents) {
            logger.error("stripe.webhook_amount_mismatch", {
              orderId,
              expected: order.subtotalCents,
              charged: amountTotal,
            });
            return new Response("Amount mismatch", { status: 400 });
          }

          const updated = await db
            .update(orders)
            .set({
              status: "confirmed",
              paymentStatus: "paid",
              checkoutProvider: "stripe",
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(and(eq(orders.id, orderId), ne(orders.paymentStatus, "paid")))
            .returning({ id: orders.id });

          if (updated.length > 0) {
            await sendOrderNotifications(orderId);
            logger.info("stripe.webhook_order_confirmed", {
              orderId,
              sessionId: session.id,
            });
          } else {
            logger.info("stripe.webhook_idempotent_skip", { orderId });
          }
        }

        if (event.type === "checkout.session.expired") {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;
          if (!orderId) {
            return new Response("OK", { status: 200 });
          }

          const db = createDb();
          // Only cancel orders still awaiting payment; a completed session
          // event wins the race and must not be undone by a late expiry.
          const cancelled = await db
            .update(orders)
            .set({
              status: "cancelled",
              paymentStatus: "abandoned",
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
            .returning({ id: orders.id });

          if (cancelled.length > 0) {
            // Give the reserved stock back so abandoned checkouts can't
            // silently sell the shop out.
            await releaseInventoryForOrder(orderId);
            logger.info("stripe.webhook_order_expired", { orderId });
          }
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
