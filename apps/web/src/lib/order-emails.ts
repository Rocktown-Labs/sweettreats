import { createDb } from "@sweettreats/db";
import { orders, pickupLocations } from "@sweettreats/db/schema/index";
import { eq } from "drizzle-orm";
import { sendAdminOrderEmail, sendCustomerOrderEmail } from "@sweettreats/email";
import { logger } from "./logger";
import { getOrderNotificationEmails } from "./notifications";
import { env } from "@sweettreats/env/server";

function readEnv(key: string): string {
  const processEnv = typeof process === "undefined" ? undefined : process.env[key];
  return String((env as Record<string, unknown>)[key] ?? processEnv ?? "");
}

function publicBaseUrl() {
  const fromEnv = readEnv("BETTER_AUTH_URL");
  return (fromEnv || "https://sweettreatslr.com").replace(/\/$/, "");
}

/**
 * Recipients for the shop-side order notification.
 *
 * Routing rules:
 * 1. If the order's pickup location has a contact email, the notification
 *    goes to the person at that place (vendor routing).
 * 2. Otherwise it falls back to the admin roster.
 */
async function shopNotificationRecipients(
  orderPickupLocationId: string | null,
): Promise<{ to: string[]; routedToLocation: boolean }> {
  if (orderPickupLocationId) {
    const db = createDb();
    try {
      const location = await db.query.pickupLocations.findFirst({
        where: eq(pickupLocations.id, orderPickupLocationId),
      });
      if (location?.contactEmail) {
        return { to: [location.contactEmail], routedToLocation: true };
      }
    } catch {
      // Fall through to admin routing.
    }
  }
  return { to: await getOrderNotificationEmails(), routedToLocation: false };
}

export async function sendOrderNotifications(orderId: string) {
  try {
    const db = createDb();
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true, pickupLocation: true },
    });

    if (!order) {
      logger.warn("order.emails_skipped_not_found", { orderId });
      return;
    }

    const resendApiKey = readEnv("RESEND_API_KEY");
    const fromEmail =
      readEnv("RESEND_FROM_EMAIL") || "Sweet Treats LR <noreply@orders.sweettreatslr.com>";
    const baseUrl = publicBaseUrl();

    const { to: shopRecipients, routedToLocation } = await shopNotificationRecipients(
      order.pickupLocationId,
    );

    const itemsProps = order.items.map((item) => ({
      name: item.itemNameSnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCentsSnapshot,
      lineTotalCents: item.lineTotalCents,
    }));

    const isShipping = order.fulfillmentType === "shipping";
    const shippingAddressText = [
      `${order.shippingName}`,
      order.shippingLine1,
      order.shippingLine2,
      `${order.shippingCity}, ${order.shippingState} ${order.shippingZip}`,
    ]
      .filter((part) => part && part.trim().length > 0)
      .join("\n");

    // 1. Send shop notification (location contact, or admins)
    const adminResult = await sendAdminOrderEmail(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        ...(isShipping
          ? {
              shippingAddress: shippingAddressText,
              shippingServiceName: order.shippingServiceName,
              shippingTotalCents: order.shippingCents + order.handlingCents,
              pickupLocationName: "Shipped",
              pickupDate: "",
              pickupTime: "",
            }
          : {
              pickupLocationName:
                order.pickupLocationName || order.pickupLocation?.name || "Little Rock Pickup (LR)",
              pickupLocationAddress: order.pickupLocation?.address || "",
              pickupDate: order.pickupDate,
              pickupTime: order.pickupTime,
            }),
        notes: order.notes,
        subtotalCents: order.subtotalCents,
        paymentStatus: order.paymentStatus === "paid" ? "paid" : "confirmed",
        items: itemsProps,
        adminDashboardUrl: `${baseUrl}/admin/orders/${order.id}`,
      },
      {
        to: shopRecipients,
        from: fromEmail,
        apiKey: resendApiKey,
      },
    );

    // 2. Send customer order confirmation (if customer email provided)
    let customerResult: import("@sweettreats/email").SendEmailResult = {
      success: true,
      mocked: true,
    };
    if (order.customerEmail) {
      customerResult = await sendCustomerOrderEmail(
        {
          orderNumber: order.orderNumber,
          orderId: order.id,
          customerName: order.customerName,
          ...(isShipping
            ? {
                shippingAddress: shippingAddressText,
                shippingServiceName: order.shippingServiceName,
                pickupLocationName: "Shipped",
                pickupDate: "",
                pickupTime: "",
              }
            : {
                pickupLocationName:
                  order.pickupLocationName ||
                  order.pickupLocation?.name ||
                  "Little Rock Pickup (LR)",
                pickupLocationAddress: order.pickupLocation?.address || "",
                pickupLocationInstructions: order.pickupLocation?.instructions || "",
                pickupDate: order.pickupDate,
                pickupTime: order.pickupTime,
              }),
          subtotalCents: order.subtotalCents,
          items: itemsProps.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            lineTotalCents: i.lineTotalCents,
          })),
          viewOrderUrl: `${baseUrl}/order/success?orderId=${order.id}`,
        },
        {
          to: order.customerEmail,
          from: fromEmail,
          apiKey: resendApiKey,
        },
      );
    }

    // No PII (recipient addresses) in logs — log routing outcome only.
    logger.info("order.emails_dispatched", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      adminSuccess: adminResult.success,
      adminMocked: adminResult.mocked,
      customerSuccess: customerResult.success,
      customerMocked: (customerResult as any).mocked,
      routedToLocation,
      shopRecipientCount: shopRecipients.length,
    });

    // Surface failures to the outbox consumer: Resend's idempotency keys
    // dedupe any re-send, so a retry is always safe. Swallowing here would
    // mark failed deliveries as "sent" and defeat the retry machinery.
    const adminFailed = shopRecipients.length > 0 && !adminResult.success;
    const customerFailed = order.customerEmail
      ? (customerResult as { success?: boolean }).success === false
      : false;
    if (adminFailed || customerFailed) {
      throw new Error(
        `Email delivery failed (admin: ${adminResult.success}, customer: ${customerResult.success})`,
      );
    }
  } catch (err) {
    logger.error("order.emails_dispatch_failed", {
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Re-throw: the caller is the queue consumer, which retries with backoff.
    throw err;
  }
}
