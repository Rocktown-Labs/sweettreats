import { Link, Outlet, useRouter, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";
import { useEffect, useRef } from "react";

import { getAdminDashboard, updateOrderStatus } from "../lib/api";
import { formatMoney, orderStatusLabel } from "../lib/format";
import {
  REALTIME_EVENT,
  lastSeenOrdersCursor,
  markOrdersSeen,
} from "../lib/use-admin-notifications";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/admin/orders")({
  loader: () => getAdminDashboard(),
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: session } = authClient.useSession();
  const router = useRouter();
  if (pathname !== "/admin/orders") {
    return <Outlet />;
  }

  const { recentOrders, statuses } = Route.useLoaderData();
  const saveStatus = useServerFn(updateOrderStatus);

  // Capture the seen-cursor BEFORE marking this visit seen, so rows that
  // arrived since the last visit can wear the "New" pill during it.
  const seenAtRef = useRef<string | null>(null);
  useEffect(() => {
    seenAtRef.current = lastSeenOrdersCursor(session?.user?.email);
    markOrdersSeen();
  }, [session?.user?.email]);

  // Realtime pushes (new order, payment, status change) refresh the list in
  // place while she's looking at it.
  useEffect(() => {
    const onRealtime = () => {
      void router.invalidate();
    };
    window.addEventListener(REALTIME_EVENT, onRealtime);
    return () => window.removeEventListener(REALTIME_EVENT, onRealtime);
  }, [router]);

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Orders</h1>
        </div>
      </div>
      {recentOrders.length === 0 ? (
        <section className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h2 style={{ marginBottom: "8px", fontFamily: "var(--font-display)" }}>
            No orders found
          </h2>
          <p className="muted">Incoming customer pickup orders will show up here.</p>
        </section>
      ) : (
        <section className="admin-list" aria-label="Orders">
          {recentOrders.map((order) => (
            <article className="admin-list-row order-list-row" key={order.id}>
              <Link to="/admin/orders/$id" params={{ id: order.id }} className="order-list-main">
                <div className="admin-row-title">
                  <strong>
                    {order.orderNumber}
                    {seenAtRef.current && order.createdAt > seenAtRef.current ? (
                      <span className="order-new-pill">New</span>
                    ) : null}
                  </strong>
                  <span>{formatMoney(order.subtotalCents)}</span>
                </div>
                <p style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span>
                    {order.customerName} · {order.pickupDate} at {order.pickupTime}
                  </span>
                  {order.pickupLocationName ? (
                    <span className="order-location-badge">
                      <MapPin size={12} aria-hidden="true" />
                      {order.pickupLocationName}
                    </span>
                  ) : null}
                </p>
                <p className="muted">
                  {order.items
                    .map((item) => `${item.quantity} x ${item.itemNameSnapshot}`)
                    .join(", ")}
                </p>
              </Link>
              <label className="field compact-field">
                <span>Status</span>
                <select
                  value={order.status}
                  onChange={async (event) => {
                    await saveStatus({
                      data: { id: order.id, status: event.currentTarget.value },
                    });
                    await router.invalidate();
                  }}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {orderStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
