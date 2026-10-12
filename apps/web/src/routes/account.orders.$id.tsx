import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarClock, ClipboardList, ShoppingBag } from "lucide-react";

import { getAccountOrder } from "../lib/api";
import { requireSignedIn } from "../lib/auth";
import { formatMoney, orderStatusLabel } from "../lib/format";

export const Route = createFileRoute("/account/orders/$id")({
  beforeLoad: ({ location }) => requireSignedIn({ data: location.href }),
  loader: ({ params }) => getAccountOrder({ data: params.id }),
  component: AccountOrderDetailPage,
});

function AccountOrderDetailPage() {
  const order = Route.useLoaderData();

  if (!order) {
    return (
      <main className="page">
        <section className="panel account-detail-empty">
          <p className="eyebrow">Order</p>
          <h1>Order not found</h1>
          <p className="muted">This order is not attached to your account.</p>
          <Link to="/account/orders" className="primary-button">
            Back to dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page account-order-detail">
      <div className="section-head admin-heading">
        <div>
          <Link to="/account/orders" className="text-link">
            &larr; Back to dashboard
          </Link>
          <p className="eyebrow">Order Details</p>
          <h1 className="page-title">{order.orderNumber}</h1>
        </div>
      </div>

      <div className="admin-metrics account-detail-metrics">
        <div className="panel admin-stat-card">
          <ClipboardList size={20} aria-hidden="true" />
          <span className="eyebrow">Status</span>
          <strong className="admin-stat-word">{orderStatusLabel(order.status)}</strong>
        </div>
        <div className="panel admin-stat-card">
          <CalendarClock size={20} aria-hidden="true" />
          <span className="eyebrow">Pickup</span>
          <strong className="admin-stat-word">
            {order.pickupDate} {order.pickupTime}
          </strong>
        </div>
        <div className="panel admin-stat-card">
          <ShoppingBag size={20} aria-hidden="true" />
          <span className="eyebrow">Items</span>
          <strong>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
        </div>
      </div>

      <div className="account-order-detail-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Pickup Information</h2>
          </div>
          <div className="customer-detail-list">
            <div>
              <span>Pickup date</span>
              <strong>{order.pickupDate}</strong>
            </div>
            <div>
              <span>Pickup time</span>
              <strong>{order.pickupTime}</strong>
            </div>
            {order.pickupLocationName ? (
              <div>
                <span>Pickup location</span>
                <strong>{order.pickupLocationName}</strong>
              </div>
            ) : null}
            {order.pickupLocation?.address ? (
              <div>
                <span>Location address</span>
                <strong>{order.pickupLocation.address}</strong>
              </div>
            ) : null}
            {order.pickupLocation?.instructions ? (
              <div>
                <span>Pickup note</span>
                <strong>{order.pickupLocation.instructions}</strong>
              </div>
            ) : null}
            <div>
              <span>Customer</span>
              <strong>{order.customerName}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{order.customerPhone}</strong>
            </div>
            <div>
              <span>Notes</span>
              <strong>{order.notes || "None"}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Order Summary</h2>
          </div>
          {order.items.map((item) => (
            <div className="receipt-line" key={item.id}>
              <span>
                {item.quantity} x {item.itemNameSnapshot}
                <small>{formatMoney(item.unitPriceCentsSnapshot)} each</small>
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
