import { Link, Outlet, useRouter, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";

import { getAdminDashboard, updateOrderStatus } from "../lib/api";
import { formatMoney, orderStatusLabel } from "../lib/format";

export const Route = createFileRoute("/admin/orders")({
  loader: () => getAdminDashboard(),
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/admin/orders") {
    return <Outlet />;
  }

  const { recentOrders, statuses } = Route.useLoaderData();
  const router = useRouter();
  const saveStatus = useServerFn(updateOrderStatus);

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
                  <strong>{order.orderNumber}</strong>
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
