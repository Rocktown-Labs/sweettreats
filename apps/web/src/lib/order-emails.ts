import { createDb } from "@sweettreats/db";
import { orders } from "@sweettreats/db/schema/index";
import { eq } from "drizzle-orm";
import { sendAdminOrderEmail, sendCustomerOrderEmail } from "@sweettreats/email";
import { logger } from "./logger";
import { adminEmails } from "./auth-server";
import { env } from "@sweettreats/env/server";

function readEnv(key: string): string {
  const processEnv = typeof process === "undefined" ? undefined : process.env[key];
  return String((env as Record<string, unknown>)[key] ?? processEnv ?? "");
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
      readEnv("RESEND_FROM_EMAIL") || "Sweet Treats LR <orders@orders.sweettreatslr.com>";

    const adminRecipients = adminEmails();
    const effectiveAdmins =
      adminRecipients.length > 0
        ? adminRecipients
        : ["lauryan0311@gmail.com", "admin@sweettreatslr.com"];

    const itemsProps = order.items.map((item) => ({
      name: item.itemNameSnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCentsSnapshot,
      lineTotalCents: item.lineTotalCents,
    }));

    // 1. Send Admin Notification
    const adminResult = await sendAdminOrderEmail(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        pickupLocationName:
          order.pickupLocationName || order.pickupLocation?.name || "Little Rock Pickup (LR)",
        pickupLocationAddress: order.pickupLocation?.address || "",
        pickupDate: order.pickupDate,
        pickupTime: order.pickupTime,
        notes: order.notes,
        subtotalCents: order.subtotalCents,
        paymentStatus: order.paymentStatus === "paid" ? "paid" : "confirmed",
        items: itemsProps,
        adminDashboardUrl: `https://sweettreatslr.com/admin/orders/${order.id}`,
      },
      {
        to: effectiveAdmins,
        from: fromEmail,
        apiKey: resendApiKey,
      },
    );

    // 2. Send Customer Order Confirmation (if customer email provided)
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
          pickupLocationName:
            order.pickupLocationName || order.pickupLocation?.name || "Little Rock Pickup (LR)",
          pickupLocationAddress: order.pickupLocation?.address || "",
          pickupLocationInstructions: order.pickupLocation?.instructions || "",
          pickupDate: order.pickupDate,
          pickupTime: order.pickupTime,
          subtotalCents: order.subtotalCents,
          items: itemsProps.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            lineTotalCents: i.lineTotalCents,
          })),
          viewOrderUrl: "https://sweettreatslr.com/order/success",
        },
        {
          to: order.customerEmail,
          from: fromEmail,
          apiKey: resendApiKey,
        },
      );
    }

    logger.info("order.emails_dispatched", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      adminSuccess: adminResult.success,
      adminMocked: adminResult.mocked,
      customerSuccess: customerResult.success,
      customerMocked: (customerResult as any).mocked,
      recipients: effectiveAdmins,
    });
  } catch (err) {
    logger.error("order.emails_dispatch_failed", {
      orderId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
