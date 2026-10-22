import { Link, Outlet, createFileRoute, useRouter, useRouterState } from "@tanstack/react-router";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getAdminDashboard, syncAllItemsToStripe } from "../lib/api";
import { formatMoney, imageUrl } from "../lib/format";

export const Route = createFileRoute("/admin/items")({
  loader: () => getAdminDashboard(),
  component: AdminItemsPage,
});

function AdminItemsPage() {
  const router = useRouter();
  const [isSyncing, setSyncing] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/admin/items") {
    return <Outlet />;
  }

  const { items, locations } = Route.useLoaderData();
  const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
  const sorted = [...items].sort((a, b) => {
    if (a.category === "Cookies" && b.category !== "Cookies") {
      return -1;
    }
    if (a.category !== "Cookies" && b.category === "Cookies") {
      return 1;
    }
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });

  const handleSyncToStripe = async () => {
    setSyncing(true);
    try {
      const res = await syncAllItemsToStripe();
      if (res.success) {
        toast.success(`Successfully synced ${res.synced} items to Stripe!`);
        await router.invalidate();
      } else {
        toast.error(res.message || "Failed to sync items to Stripe.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sync items to Stripe.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Items</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="secondary-button"
            disabled={isSyncing}
            onClick={handleSyncToStripe}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{isSyncing ? "Syncing to Stripe..." : "Sync to Stripe"}</span>
          </button>
          <Link to="/admin/items/$id" params={{ id: "new" }} className="primary-button">
            <Plus size={18} aria-hidden="true" />
            Add item
          </Link>
        </div>
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
                {item.trackInventory ? (
                  item.packSize ? (
                    <span>from cookies inside</span>
                  ) : item.stockByLocation && item.stockByLocation.length > 0 ? (
                    <span>
                      {item.stockByLocation
                        .slice()
                        .sort((a, b) =>
                          (locationNameById.get(a.locationId) ?? "").localeCompare(
                            locationNameById.get(b.locationId) ?? "",
                          ),
                        )
                        .map(
                          (row) =>
                            `${locationNameById.get(row.locationId) ?? "Unknown"}: ${row.quantity}`,
                        )
                        .join(" · ")}
                    </span>
                  ) : (
                    <span>{item.inventoryQuantity} left</span>
                  )
                ) : (
                  <span>No count</span>
                )}
                <span>{item.available ? "Visible" : "Hidden"}</span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
