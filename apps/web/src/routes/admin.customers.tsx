import { Link, createFileRoute } from "@tanstack/react-router";

import { getAdminDashboard } from "../lib/api";
import { formatMoney } from "../lib/format";

export const Route = createFileRoute("/admin/customers")({
  loader: () => getAdminDashboard(),
  component: AdminCustomersPage,
});

function AdminCustomersPage() {
  const { recentOrders } = Route.useLoaderData();
  const customers = new Map<
    string,
    {
      name: string;
      email: string;
      phone: string;
      orderCount: number;
      totalCents: number;
      lastPickup: string;
      lastOrderId: string;
    }
  >();

  for (const order of recentOrders) {
    const key = order.customerEmail || order.customerPhone || order.customerName;
    const current = customers.get(key) ?? {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
      orderCount: 0,
      totalCents: 0,
      lastPickup: order.pickupDate,
      lastOrderId: order.id,
    };

    customers.set(key, {
      ...current,
      name: order.customerName || current.name,
      email: order.customerEmail || current.email,
      phone: order.customerPhone || current.phone,
      orderCount: current.orderCount + 1,
      totalCents: current.totalCents + order.subtotalCents,
      lastPickup: order.pickupDate,
      lastOrderId: order.id,
    });
  }

  const sortedCustomers = [...customers.values()].sort((a, b) => b.totalCents - a.totalCents);

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Customers</h1>
        </div>
      </div>
      <section className="admin-list" aria-label="Customers">
        {sortedCustomers.map((customer) => (
          <article
            className="admin-list-row customer-list-row"
            key={customer.email || customer.phone}
          >
            <div className="customer-avatar" aria-hidden="true">
              {customer.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="admin-row-title">
                <strong>{customer.name}</strong>
                <span>{formatMoney(customer.totalCents)}</span>
              </div>
              <p className="muted">
                {customer.email} · {customer.phone}
              </p>
              <div className="admin-row-meta">
                <span>{customer.orderCount} orders</span>
                <span>Last pickup {customer.lastPickup}</span>
                <Link to="/admin/orders/$id" params={{ id: customer.lastOrderId }}>
                  Latest order
                </Link>
              </div>
            </div>
          </article>
        ))}
        {sortedCustomers.length === 0 ? (
          <section className="panel">No customers yet.</section>
        ) : null}
      </section>
    </div>
  );
}
