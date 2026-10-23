import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { DbProvider, useLiveQuery } from "@tanstack/react-db";
import { MapPin } from "lucide-react";
import { orderStatuses } from "@sweettreats/db/schema/index";
import { useEffect, useRef, useState } from "react";

import { adminDbClient, useAdminOrdersCollection } from "../lib/admin-orders-db";
import { formatMoney, orderStatusLabel } from "../lib/format";
import {
  REALTIME_EVENT,
  lastSeenOrdersCursor,
  markOrdersSeen,
} from "../lib/use-admin-notifications";
import { authClient } from "../lib/auth-client";

/**
 * Orders list — the TanStack DB spike page.
 *
 * Rows come from a reactive collection (src/lib/admin-orders-db.ts) instead
 * of a route loader: realtime pushes refetch the collection and rows
 * re-render in place; status changes write optimistically and roll back if
 * the server rejects them. The page mounts its data client-side (skeleton
 * until then) since it's admin-only anyway.
 */
export const Route = createFileRoute("/admin/orders")({
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/admin/orders") {
    return <Outlet />;
  }

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Orders</h1>
        </div>
      </div>
      <DbProvider client={adminDbClient}>
        <AdminOrdersList />
      </DbProvider>
    </div>
  );
}

function AdminOrdersList() {
  const collection = useAdminOrdersCollection();
  const { data: recentOrders, isLoading } = useLiveQuery({
    query: (q) => q.from({ order: collection }).orderBy(({ order }) => order.createdAt, "desc"),
  });

  // The collection fetches on the client; SSR renders the skeleton so
  // hydration always matches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: session } = authClient.useSession();

  // Capture the seen-cursor BEFORE marking this visit seen, so rows that
  // arrived since the last visit can wear the "New" pill during it.
  const seenAtRef = useRef<string | null>(null);
  useEffect(() => {
    seenAtRef.current = lastSeenOrdersCursor(session?.user?.email);
    markOrdersSeen();
  }, [session?.user?.email]);

  // Realtime pushes (new order, payment, status change) refresh the
  // collection in place — no router invalidation needed.
  useEffect(() => {
    const onRealtime = () => {
      void collection.utils.refetch();
    };
    window.addEventListener(REALTIME_EVENT, onRealtime);
    return () => window.removeEventListener(REALTIME_EVENT, onRealtime);
  }, [collection]);

  if (!mounted || isLoading) {
    return (
      <section className="admin-list" aria-busy="true" aria-label="Loading orders">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="admin-list-row skeleton-card"
            style={{ minHeight: "110px" }}
            aria-hidden="true"
          />
        ))}
      </section>
    );
  }

  if (recentOrders.length === 0) {
    return (
      <section className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
        <h2 style={{ marginBottom: "8px", fontFamily: "var(--font-display)" }}>No orders found</h2>
        <p className="muted">Incoming customer pickup orders will show up here.</p>
      </section>
    );
  }

  return (
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
              {order.items.map((item) => `${item.quantity} x ${item.itemNameSnapshot}`).join(", ")}
            </p>
          </Link>
          <label className="field compact-field">
            <span>Status</span>
            <select
              value={order.status}
              onChange={(event) => {
                // Optimistic: the row's status flips instantly and rolls
                // back if the server rejects the change.
                collection.update(order.id, (draft) => {
                  draft.status = event.currentTarget.value as (typeof orderStatuses)[number];
                });
              }}
            >
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </article>
      ))}
    </section>
  );
}
