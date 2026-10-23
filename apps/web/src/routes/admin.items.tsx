import { Link, Outlet, createFileRoute, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { adjustLocationStock, getAdminDashboard, syncAllItemsToStripe } from "../lib/api";
import { formatMoney, imageUrl } from "../lib/format";

export const Route = createFileRoute("/admin/items")({
  loader: () => getAdminDashboard(),
  component: AdminItemsPage,
});

/** "Little Rock Pickup (LR)" → "LR"; falls back to the first word. */
function shortLocationLabel(name: string): string {
  const abbreviation = name.match(/\(([A-Z]{2,5})\)/)?.[1];
  return abbreviation ?? name.split(/\s+/)[0] ?? name;
}

function AdminItemsPage() {
  const router = useRouter();
  const [isSyncing, setSyncing] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null);
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

  const adjustStock = useServerFn(adjustLocationStock);

  // In-store sale: subtract one from a location's pool right from the list.
  const handleSoldInStore = async (
    itemId: string,
    locationId: string,
    locationName: string,
    currentQuantity: number,
  ) => {
    if (currentQuantity <= 0) {
      toast.error("That spot already reads zero — restock from the item page instead.");
      return;
    }
    const key = `${itemId}:${locationId}`;
    setAdjusting(key);
    try {
      const result = await adjustStock({ data: { itemId, locationId, delta: -1 } });
      toast.success(
        `Sold one at ${locationName} — ${result.quantity} left. The web store just saw it too.`,
      );
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not adjust stock.");
    } finally {
      setAdjusting(null);
    }
  };

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

  const quickStockRows = (item: (typeof sorted)[number]) => {
    if (!item.trackInventory || item.packSize || !item.stockByLocation) {
      return [];
    }
    return item.stockByLocation
      .slice()
      .sort((a, b) =>
        (locationNameById.get(a.locationId) ?? "").localeCompare(
          locationNameById.get(b.locationId) ?? "",
        ),
      );
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
        {sorted.map((item) => {
          const quickRows = quickStockRows(item);
          return (
            <article
              key={item.id}
              className={`admin-list-row${quickRows.length > 0 ? " with-quick" : ""}`}
            >
              <Link to="/admin/items/$id" params={{ id: item.id }} className="admin-row-link">
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
                      ) : quickRows.length > 0 ? (
                        <span>counts on the right · −1 = sold in store</span>
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
              {quickRows.length > 0 ? (
                <div className="quick-stock" aria-label="In-store sale adjustments">
                  {quickRows.map((row) => {
                    const locationName = locationNameById.get(row.locationId) ?? "Unknown";
                    const shortLabel = shortLocationLabel(locationName);
                    const key = `${item.id}:${row.locationId}`;
                    return (
                      <button
                        key={row.locationId}
                        type="button"
                        className="quick-stock-button"
                        title={`Sold one at ${locationName} — subtract from this location's count`}
                        aria-label={`Sold one at ${locationName}, ${row.quantity} currently left`}
                        disabled={adjusting !== null || row.quantity <= 0}
                        onClick={() =>
                          void handleSoldInStore(
                            item.id,
                            row.locationId,
                            locationName,
                            row.quantity,
                          )
                        }
                      >
                        <span>{shortLabel}</span>
                        <strong>{row.quantity}</strong>
                        <Minus
                          size={13}
                          aria-hidden="true"
                          className={adjusting === key ? "animate-spin" : undefined}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
