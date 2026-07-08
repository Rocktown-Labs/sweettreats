import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Package,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getAccountOrders } from "../lib/api";
import { requireSignedIn } from "../lib/auth";
import { formatMoney, orderStatusLabel } from "../lib/format";
import { authClient } from "../lib/auth-client";
import { useCart } from "../lib/cart";

export const Route = createFileRoute("/account/orders")({
  beforeLoad: ({ location }) => requireSignedIn({ data: location.href }),
  loader: () => getAccountOrders(),
  component: AccountOrdersPage,
  pendingComponent: AccountOrdersPending,
});

function AccountOrdersPending() {
  return (
    <main className="page">
      <div className="section-head">
        <div>
          <p
            className="eyebrow skeleton"
            style={{ width: "60px", height: "14px", marginBottom: "8px" }}
          ></p>
          <h1 className="page-title skeleton" style={{ width: "220px", height: "48px" }}></h1>
        </div>
      </div>
      <div className="grid-cookies">
        {Array.from({ length: 3 }).map((_, index) => (
          <article className="skeleton-card" key={index}>
            <div
              className="skeleton"
              style={{ width: "80px", height: "14px", marginBottom: "8px" }}
            ></div>
            <div
              className="skeleton"
              style={{ width: "140px", height: "24px", marginBottom: "12px" }}
            ></div>
            <div className="skeleton skeleton-text" style={{ width: "90%" }}></div>
            <div className="skeleton skeleton-text" style={{ width: "70%" }}></div>
            <div
              className="skeleton"
              style={{ width: "60px", height: "20px", marginTop: "8px" }}
            ></div>
          </article>
        ))}
      </div>
    </main>
  );
}

function CustomerNav() {
  return (
    <nav className="admin-nav" aria-label="Customer navigation">
      <Link to="/account/orders" activeOptions={{ exact: true }}>
        <ClipboardList size={18} aria-hidden="true" />
        <span>Dashboard</span>
      </Link>
      <Link to="/menu">
        <Package size={18} aria-hidden="true" />
        <span>Browse Menu</span>
      </Link>
      <Link to="/cart">
        <ShoppingBag size={18} aria-hidden="true" />
        <span>Cart</span>
      </Link>
    </nav>
  );
}

function AccountOrdersPage() {
  const orders = Route.useLoaderData();
  const { data: session } = authClient.useSession();
  const cart = useCart();
  const nextOrder = orders.find((order) => !["completed", "cancelled"].includes(order.status));
  const totalSpentCents = orders.reduce((sum, order) => sum + order.subtotalCents, 0);

  const [name, setName] = useState(session?.user?.name || "");
  const [email, setEmail] = useState(session?.user?.email || "");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name);
      setEmail(session.user.email);
    }
  }, [session]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await authClient.updateUser({
        name,
      });
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <main className="page admin-page">
      <CustomerNav />
      <div className="admin-main">
        <div className="section-head admin-heading">
          <div>
            <p className="eyebrow">Customer Dashboard</p>
            <h1 className="page-title">Welcome, {session?.user?.name || "Customer"}!</h1>
          </div>
        </div>

        <div className="admin-metrics">
          <div className="panel admin-stat-card">
            <ClipboardList size={20} aria-hidden="true" />
            <span className="eyebrow">Orders Placed</span>
            <strong>{orders.length}</strong>
          </div>
          <div className="panel admin-stat-card">
            <ShoppingBag size={20} aria-hidden="true" />
            <span className="eyebrow">Active Cart Items</span>
            <strong>{cart.count}</strong>
          </div>
          <div className="panel admin-stat-card">
            <CalendarClock size={20} aria-hidden="true" />
            <span className="eyebrow">Next Pickup</span>
            <strong className="admin-stat-word">
              {nextOrder ? `${nextOrder.pickupDate.slice(5)} ${nextOrder.pickupTime}` : "None"}
            </strong>
          </div>
          <div className="panel admin-stat-card">
            <Users size={20} aria-hidden="true" />
            <span className="eyebrow">Total Spent</span>
            <strong className="admin-stat-word">{formatMoney(totalSpentCents)}</strong>
          </div>
        </div>

        <div className="customer-dashboard-grid">
          <section className="panel customer-orders-panel">
            <div className="panel-head">
              <h2>Order History</h2>
              <Link to="/menu" className="text-link">
                Order again
              </Link>
            </div>
            {orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p className="muted" style={{ marginBottom: "12px" }}>
                  No orders placed yet.
                </p>
                <Link to="/menu" className="text-link">
                  Browse Menu &rarr;
                </Link>
              </div>
            ) : (
              <div className="customer-order-list">
                {orders.map((order) => (
                  <Link
                    to="/account/orders/$id"
                    params={{ id: order.id }}
                    key={order.id}
                    className="customer-order-row"
                  >
                    <div className="customer-order-main">
                      <div className="customer-order-title">
                        <strong>{order.orderNumber}</strong>
                        <span>{orderStatusLabel(order.status)}</span>
                      </div>
                      <p className="muted">
                        Pickup {order.pickupDate} at {order.pickupTime}
                      </p>
                      <p className="customer-order-items">
                        {order.items
                          .map((item) => `${item.quantity}x ${item.itemNameSnapshot}`)
                          .join(", ")}
                      </p>
                    </div>
                    <div className="customer-order-side">
                      <strong>{formatMoney(order.subtotalCents)}</strong>
                      <span>
                        Details <ArrowRight size={15} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="panel customer-actions-panel">
            <div className="panel-head">
              <h2>Quick Actions</h2>
            </div>
            <div className="customer-action-list">
              <Link to="/menu">
                <Package size={18} aria-hidden="true" />
                <span>
                  <strong>Browse today's menu</strong>
                  <small>See available cookies and inventory.</small>
                </span>
              </Link>
              <Link to="/cart">
                <ShoppingBag size={18} aria-hidden="true" />
                <span>
                  <strong>Review your cart</strong>
                  <small>
                    {cart.count
                      ? `${cart.count} item${cart.count === 1 ? "" : "s"} waiting`
                      : "Start a new box."}
                  </small>
                </span>
              </Link>
              {nextOrder ? (
                <Link to="/account/orders/$id" params={{ id: nextOrder.id }}>
                  <CalendarClock size={18} aria-hidden="true" />
                  <span>
                    <strong>Check next pickup</strong>
                    <small>
                      {nextOrder.orderNumber} on {nextOrder.pickupDate}.
                    </small>
                  </span>
                </Link>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Account Settings</h2>
            </div>
            <form
              onSubmit={handleUpdateProfile}
              className="field-grid"
              style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}
            >
              <label className="field">
                <span>Full Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="field">
                <span>Email Address</span>
                <input value={email} disabled style={{ opacity: 0.7, cursor: "not-allowed" }} />
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Email change is locked.
                </span>
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={isUpdating}
                style={{ marginTop: "12px", width: "100%" }}
              >
                {isUpdating ? "Saving..." : "Save profile"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
