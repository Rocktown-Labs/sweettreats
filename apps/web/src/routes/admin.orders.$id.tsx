import { Link, useRouter, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AdminNav } from "../components/admin-nav";
import { getAdminDashboard, getAdminOrder, updateOrderStatus } from "../lib/api";
import { formatMoney, orderStatusLabel } from "../lib/format";

export const Route = createFileRoute("/admin/orders/$id")({
  loader: async ({ params }) => {
    const [order, dashboard] = await Promise.all([
      getAdminOrder({ data: params.id }),
      getAdminDashboard(),
    ]);
    return { order, statuses: dashboard.statuses };
  },
  component: AdminOrderDetailPage,
});

function AdminOrderDetailPage() {
  const { order, statuses } = Route.useLoaderData();
  const router = useRouter();
  const saveStatus = useServerFn(updateOrderStatus);

  if (!order) {
    return (
      <main className="page admin-page">
        <AdminNav />
        <div className="admin-main">
          <section className="panel">Order not found.</section>
        </div>
      </main>
    );
  }

  return (
    <main className="page admin-page">
      <AdminNav />
      <div className="admin-main">
        <div className="section-head admin-heading">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Link to="/admin/orders" className="text-link" style={{ fontSize: "0.9rem" }}>
                &larr; Back to orders
              </Link>
            </div>
            <p className="eyebrow">Order</p>
            <h1 className="page-title">{order.orderNumber}</h1>
          </div>
        </div>
        <div className="admin-detail-grid">
          <section className="panel">
            <p className="eyebrow">Customer</p>
            <h2>{order.customerName}</h2>
            <p>{order.customerEmail}</p>
            <p>{order.customerPhone}</p>
            <p className="muted">Notes: {order.notes || "None"}</p>
          </section>
          <section className="panel">
            <p className="eyebrow">Pickup</p>
            <h2>
              {order.pickupDate} at {order.pickupTime}
            </h2>
            <label className="field">
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
          </section>
        </div>
        <section className="panel" style={{ marginTop: 18 }}>
          <p className="eyebrow">Items</p>
          {order.items.map((item) => (
            <div className="receipt-line" key={item.id}>
              <span>
                {item.quantity} x {item.itemNameSnapshot}
              </span>
              <strong>{formatMoney(item.lineTotalCents)}</strong>
            </div>
          ))}
          <div className="receipt-line receipt-total">
            <span>Total</span>
            <strong>{formatMoney(order.subtotalCents)}</strong>
          </div>
        </section>
      </div>
    </main>
  );
}
