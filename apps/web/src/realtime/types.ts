/**
 * Shared realtime event contract between the server (publish points), the
 * NotificationCenter Durable Object, and the admin client hook.
 *
 * Keep this additive: old clients ignore unknown event types.
 */
export type AdminRealtimeEvent =
  | {
      type: "order.new";
      orderId: string;
      orderNumber: string;
    }
  | {
      type: "order.updated";
      orderId: string;
      orderNumber: string;
      /** New order status when the change is a status transition. */
      status?: string;
      paymentStatus?: string;
    };
