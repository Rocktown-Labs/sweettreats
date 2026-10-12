import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createDb } from "@sweettreats/db";
import { orders } from "@sweettreats/db/schema/index";
import { eq } from "drizzle-orm";
import { sendOrderNotifications } from "@/lib/order-emails";
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

        if (!stripeSecretKey) {
          return new Response("Stripe not configured", { status: 400 });
        }

        const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" as any });
        const body = await request.text();

        let event: Stripe.Event;
        try {
          if (webhookSecret && signature) {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
          } else {
            event = JSON.parse(body) as Stripe.Event;
          }
        } catch (err) {
          logger.error("stripe.webhook_signature_failed", {
            error: err instanceof Error ? err.message : String(err),
          });
          return new Response("Invalid signature", { status: 400 });
        }

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;
          if (orderId) {
            const db = createDb();
            await db
              .update(orders)
              .set({
                status: "confirmed",
                paymentStatus: "paid",
                checkoutProvider: "stripe",
              })
              .where(eq(orders.id, orderId));

            await sendOrderNotifications(orderId);
            logger.info("stripe.webhook_order_confirmed", {
              orderId,
              sessionId: session.id,
            });
          }
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
