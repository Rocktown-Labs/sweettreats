import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { Package, ShoppingBag, Users } from "lucide-react";

import { AdminNav } from "../components/admin-nav";
import { getAdminDashboard } from "../lib/api";
import { formatMoney, orderStatusLabel } from "../lib/format";

export const Route = createFileRoute("/admin")({
  loader: () => getAdminDashboard(),
  component: AdminPage,
  pendingComponent: AdminPending,
});

function AdminPending() {
  return (
    <main className="page admin-page">
      <AdminNav />
      <div className="admin-main">
        <div className="section-head admin-heading">
          <div>
            <p
              className="eyebrow skeleton"
              style={{ width: "60px", height: "14px", marginBottom: "8px" }}
            ></p>
            <h1 className="page-title skeleton" style={{ width: "200px", height: "48px" }}></h1>
          </div>
        </div>
        <div className="admin-metrics">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="panel skeleton-card"
              style={{ height: "118px", minHeight: "118px" }}
            >
              <div className="skeleton" style={{ width: "20px", height: "20px" }}></div>
              <div
                className="skeleton"
                style={{ width: "70px", height: "12px", marginTop: "12px" }}
              ></div>
              <div
                className="skeleton"
                style={{ width: "40px", height: "24px", marginTop: "8px" }}
              ></div>
            </div>
          ))}
        </div>
        <div className="admin-dashboard-grid">
          <section className="panel">
            <div className="panel-head">
              <div className="skeleton" style={{ width: "100px", height: "20px" }}></div>
            </div>
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: "1px solid #ecdcd3",
                }}
              >
                <div style={{ width: "60%" }}>
                  <div
                    className="skeleton"
                    style={{ width: "80px", height: "14px", marginBottom: "6px" }}
                  ></div>
                  <div className="skeleton" style={{ width: "150px", height: "12px" }}></div>
                </div>
                <div className="skeleton" style={{ width: "50px", height: "16px" }}></div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}

function AdminPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/admin") {
    return <Outlet />;
  }

  const { items, recentOrders } = Route.useLoaderData();
  const openOrders = recentOrders.filter(
    (order) => !["completed", "cancelled"].includes(order.status),
  );
  const tracked = items.filter((item) => item.trackInventory);
  const revenueCents = recentOrders.reduce((sum, order) => sum + order.subtotalCents, 0);
  const uniqueCustomers = new Set(
    recentOrders.map((order) => order.customerEmail || order.customerPhone).filter(Boolean),
  ).size;
  const itemCounts = new Map<string, { quantity: number; revenueCents: number }>();
  for (const order of recentOrders) {
    for (const item of order.items) {
      const current = itemCounts.get(item.itemNameSnapshot) ?? { quantity: 0, revenueCents: 0 };
      itemCounts.set(item.itemNameSnapshot, {
        quantity: current.quantity + item.quantity,
        revenueCents: current.revenueCents + item.lineTotalCents,
      });
    }
  }
  const topItems = [...itemCounts.entries()]
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return (
    <main className="page admin-page">
      <AdminNav />
      <div className="admin-main">
        <div className="section-head">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="page-title">Shop Desk</h1>
          </div>
        </div>
        <div className="admin-metrics">
          <Link to="/admin/orders" className="panel admin-stat-card">
            <ShoppingBag size={20} aria-hidden="true" />
            <span className="eyebrow">Open orders</span>
            <strong>{openOrders.length}</strong>
          </Link>
          <Link to="/admin/items" className="panel admin-stat-card">
            <Package size={20} aria-hidden="true" />
            <span className="eyebrow">Menu items</span>
            <strong>{items.length}</strong>
          </Link>
          <Link to="/admin/customers" className="panel admin-stat-card">
            <Users size={20} aria-hidden="true" />
            <span className="eyebrow">Customers</span>
            <strong>{uniqueCustomers}</strong>
          </Link>
          <section className="panel admin-stat-card">
            <span className="eyebrow">Recent revenue</span>
            <strong>{formatMoney(revenueCents)}</strong>
          </section>
        </div>
        <div className="admin-dashboard-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>Pickup queue</h2>
              <Link to="/admin/orders" className="text-link">
                View orders
              </Link>
            </div>
            {recentOrders.slice(0, 5).map((order) => (
              <Link
                key={order.id}
                to="/admin/orders/$id"
                params={{ id: order.id }}
                className="overview-order-link"
              >
                <span>
                  <strong>{order.customerName}</strong>
                  <small>
                    {order.pickupDate} at {order.pickupTime} · {orderStatusLabel(order.status)}
                  </small>
                </span>
                <strong>{formatMoney(order.subtotalCents)}</strong>
              </Link>
            ))}
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Inventory watch</h2>
              <Link to="/admin/items" className="text-link">
                Edit items
              </Link>
            </div>
            <div className="compact-list">
              {tracked.map((item) => (
                <Link key={item.id} to="/admin/items/$id" params={{ id: item.id }}>
                  <span>{item.name}</span>
                  <strong>{item.inventoryQuantity}</strong>
                </Link>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Top sellers</h2>
            </div>
            <div className="compact-list">
              {topItems.map((item) => (
                <div key={item.name}>
                  <span>{item.name}</span>
                  <strong>{item.quantity} sold</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
