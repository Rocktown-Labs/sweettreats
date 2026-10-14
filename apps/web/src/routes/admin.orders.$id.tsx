import { Link, useRouter, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Phone } from "lucide-react";

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
      <div className="admin-main">
        <section className="panel">Order not found.</section>
      </div>
    );
  }

  return (
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
        {order.fulfillmentType === "shipping" ? (
          <section className="panel">
            <p className="eyebrow">Shipping</p>
            <h2>{order.shippingServiceName || "USPS"}</h2>
            <div className="pickup-location-detail" style={{ margin: "14px 0 10px" }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#1b0f08",
                }}
              >
                <MapPin size={16} aria-hidden="true" style={{ color: "#b9823b" }} />
                <span>
                  {order.shippingName} — {order.shippingCity}, {order.shippingState}{" "}
                  {order.shippingZip}
                </span>
              </p>
              <p className="muted" style={{ margin: "3px 0 0 22px", fontSize: "0.85rem" }}>
                {order.shippingLine1}
                {order.shippingLine2 ? `, ${order.shippingLine2}` : ""}
              </p>
              {order.shippingCents + order.handlingCents > 0 ? (
                <p className="muted" style={{ margin: "4px 0 0 22px", fontSize: "0.85rem" }}>
                  Shipping + handling: $
                  {((order.shippingCents + order.handlingCents) / 100).toFixed(2)} · Total: $
                  {(order.totalCents / 100).toFixed(2)}
                </p>
              ) : null}
              {order.trackingNumber ? (
                <p style={{ margin: "6px 0 0 22px", fontSize: "0.85rem" }}>
                  Tracking: {order.trackingNumber}
                  {order.trackingUrl ? (
                    <>
                      {" "}
                      <a
                        href={order.trackingUrl}
                        className="text-link"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Track package
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="panel">
            <p className="eyebrow">Pickup</p>
            <h2>
              {order.pickupDate} at {order.pickupTime}
            </h2>

            {order.pickupLocationName ? (
              <div className="pickup-location-detail" style={{ margin: "14px 0 10px" }}>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#1b0f08",
                  }}
                >
                  <MapPin size={16} aria-hidden="true" style={{ color: "#b9823b" }} />
                  <span>{order.pickupLocationName}</span>
                </p>
                {order.pickupLocation?.address ? (
                  <p className="muted" style={{ margin: "3px 0 0 22px", fontSize: "0.85rem" }}>
                    {order.pickupLocation.address}
                  </p>
                ) : null}
                {order.pickupLocation?.phone ? (
                  <p style={{ margin: "4px 0 0 22px", fontSize: "0.85rem" }}>
                    <a
                      href={`tel:${order.pickupLocation.phone}`}
                      className="text-link"
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Phone size={13} aria-hidden="true" />
                      Call location: {order.pickupLocation.phone}
                    </a>
                  </p>
                ) : null}
                {order.pickupLocation?.instructions ? (
                  <p
                    className="muted"
                    style={{ margin: "4px 0 0 22px", fontSize: "0.8rem", fontStyle: "italic" }}
                  >
                    Note: {order.pickupLocation.instructions}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div
              className="dispatch-reminder"
              style={{
                background: "#fff9eb",
                border: "1.5px solid #d8ae6a",
                borderRadius: "8px",
                padding: "10px 12px",
                margin: "12px 0 16px",
                fontSize: "0.84rem",
                lineHeight: 1.4,
              }}
            >
              <strong style={{ display: "block", color: "#2a160d", marginBottom: "2px" }}>
                Staff Dispatch:
              </strong>
              Call {order.pickupLocationName || "the pickup spot"} to relay customer order ticket.
            </div>

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
        )}
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
  );
}
