import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { getAdminDashboard } from "../lib/api";
import { formatMoney, imageUrl } from "../lib/format";

export const Route = createFileRoute("/admin/items")({
  loader: () => getAdminDashboard(),
  component: AdminItemsPage,
});

function AdminItemsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/admin/items") {
    return <Outlet />;
  }

  const { items } = Route.useLoaderData();
  const sorted = [...items].sort((a, b) => {
    if (a.category === "Cookies" && b.category !== "Cookies") {
      return -1;
    }
    if (a.category !== "Cookies" && b.category === "Cookies") {
      return 1;
    }
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Items</h1>
        </div>
        <Link to="/admin/items/$id" params={{ id: "new" }} className="primary-button">
          <Plus size={18} aria-hidden="true" />
          Add item
        </Link>
      </div>
      <section className="admin-list" aria-label="Menu items">
        {sorted.map((item) => (
          <Link
            key={item.id}
            to="/admin/items/$id"
            params={{ id: item.id }}
            className="admin-list-row"
          >
            <img src={imageUrl(item.imageKey)} alt="" className="admin-list-thumb" />
            <div>
              <div className="admin-row-title">
                <strong>{item.name}</strong>
                <span>{formatMoney(item.priceCents)}</span>
              </div>
              <p className="muted">{item.description}</p>
              <div className="admin-row-meta">
                <span>{item.category === "Main Cookies" ? "Cookies" : item.category}</span>
                <span>{item.trackInventory ? `${item.inventoryQuantity} left` : "No count"}</span>
                <span>{item.available ? "Visible" : "Hidden"}</span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
