import { DbClient, collectionOptions, useDbClient } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { QueryClient } from "@tanstack/query-core";
import { orderStatuses } from "@sweettreats/db/schema/index";

import { getAdminOrders, updateOrderStatus } from "./api";
import { logger } from "./logger";

/**
 * TanStack DB spike: the admin Orders page as a reactive collection.
 *
 * The page reads rows through a live query, so realtime pushes (new order,
 * payment, status change from another tab) just call utils.refetch() and the
 * rows re-render in place — no loader plumbing. Status changes write
 * optimistically into the collection and persist through the real
 * updateOrderStatus server fn; a failed write rolls the row back
 * automatically.
 *
 * Client-side by design: the admin page SSRs its shell and the collection
 * fetches on mount (getAdminOrders is admin-gated, so there is no
 * server-rendered data to hydrate). If this feels right, the same pattern
 * can extend to items/carts.
 */

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, refetchOnWindowFocus: false } },
});

export const adminDbClient = new DbClient({ queryClient });

export type AdminOrder = Awaited<ReturnType<typeof getAdminOrders>>["orders"][number];

export const adminOrdersCollection = collectionOptions("adminOrders", (client) =>
  queryCollectionOptions({
    id: "adminOrders",
    queryKey: ["admin", "orders"],
    queryClient: client.requireDependency<QueryClient>("queryClient"),
    queryFn: async () => {
      const result = await getAdminOrders();
      return result.orders;
    },
    getKey: (order: AdminOrder) => order.id,
    // Optimistic status writes persist through the real server fn. Throwing
    // here rolls the row back to its synced state.
    onUpdate: async ({ transaction }) => {
      const { original, changes } = transaction.mutations[0];
      if (typeof changes.status !== "string") {
        return { refetch: false };
      }
      try {
        await updateOrderStatus({
          data: { id: original.id, status: changes.status as (typeof orderStatuses)[number] },
        });
      } catch (error) {
        logger.error("admin_orders.status_write_failed", {
          orderId: original.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      // The realtime channel already pings other tabs; no refetch needed.
      return { refetch: false };
    },
  }),
);

export function useAdminOrdersCollection() {
  return useDbClient().collection(adminOrdersCollection);
}
