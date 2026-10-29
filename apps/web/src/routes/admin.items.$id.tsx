import { Link, useNavigate, useRouter, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  deleteMenuItem,
  getAdminDashboard,
  getAdminMenuItem,
  getAdminPickupLocations,
  saveMenuItem,
  uploadMenuPhoto,
} from "../lib/api";
import { imageUrl } from "../lib/format";

export const Route = createFileRoute("/admin/items/$id")({
  loader: ({ params }) => getAdminMenuItem({ data: params.id }),
  component: AdminItemDetailPage,
});

const categories = ["Cookies", "Banana pudding", "Cheesecake jars", "Drinks", "Other"];

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  return dataUrl.split(",")[1] ?? "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function AdminItemDetailPage() {
  const item = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const saveItem = useServerFn(saveMenuItem);
  const uploadPhoto = useServerFn(uploadMenuPhoto);
  const removeItem = useServerFn(deleteMenuItem);
  const [name, setName] = useState(item?.name ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [error, setError] = useState("");
  const [isSaving, setSaving] = useState(false);
  // Shipping / pack fields
  const [packSize, setPackSize] = useState<string>(item?.packSize ? String(item.packSize) : "");
  const [packTare, setPackTare] = useState(item?.packTareOunces ? String(item.packTareOunces) : "");
  const [packContentsState, setPackContentsState] = useState<
    { cookieItemId: string; quantity: number }[]
  >(
    (item as { packContents?: { cookieItemId: string; quantity: number }[] } | null)
      ?.packContents ?? [],
  );

  // Per-location stock: each pickup spot has its own pool. The loader provides
  // rows + locations for existing items; new items fetch the location list.
  // Inputs are uncontrolled (read from FormData on submit) — state is only
  // the prefill source.
  const [stockLocations, setStockLocations] = useState<{ id: string; name: string }[]>(
    (item as { locations?: { id: string; name: string }[] } | null)?.locations ?? [],
  );
  const [stockByLocation] = useState<{ locationId: string; quantity: number }[]>(
    (item as { stockByLocation?: { locationId: string; quantity: number }[] } | null)
      ?.stockByLocation ?? [],
  );
  const fetchLocations = useServerFn(getAdminPickupLocations);
  useEffect(() => {
    if (stockLocations.length > 0) {
      return;
    }
    let cancelled = false;
    fetchLocations()
      .then((locations) => {
        if (!cancelled) {
          setStockLocations(
            locations.map((location) => ({ id: location.id, name: location.name })),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fetchLocations, stockLocations.length]);
  const normalizedCategory = item?.category === "Main Cookies" ? "Cookies" : item?.category;
  const categoryOptions = useMemo(
    () =>
      normalizedCategory && !categories.includes(normalizedCategory)
        ? [...categories, normalizedCategory]
        : categories,
    [normalizedCategory],
  );

  const packContentsTotal = packContentsState.reduce((sum, row) => sum + row.quantity, 0);
  const packSizeValue = Number(packSize);

  // Cookie options for the pack contents editor (non-pack items only).
  const fetchDashboard = useServerFn(getAdminDashboard);
  const [cookieOptions, setCookieOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard()
      .then((result) => {
        if (!cancelled) {
          setCookieOptions(
            (result.items ?? [])
              .filter((option) => !option.packSize && option.id !== item?.id)
              .map((option) => ({ id: option.id, name: option.name })),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fetchDashboard, item?.id]);

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Link to="/admin/items" className="text-link" style={{ fontSize: "0.9rem" }}>
              &larr; Back to items
            </Link>
          </div>
          <p className="eyebrow">{item ? "Edit item" : "New item"}</p>
          <h1 className="page-title">{item ? item.name : "Add item"}</h1>
        </div>
      </div>
      <form
        className="admin-detail-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSaving(true);
          const form = new FormData(event.currentTarget);
          const file = form.get("photo");
          let imageKey = String(form.get("imageKey") ?? "") || item?.imageKey || null;

          try {
            if (file instanceof File && file.size > 0) {
              const uploaded = await uploadPhoto({
                data: {
                  fileName: file.name,
                  contentType: file.type || "application/octet-stream",
                  base64: await fileToBase64(file),
                },
              });
              imageKey = uploaded.key;
            }

            // Per-location stock rows (uncontrolled inputs, read on submit).
            const stockByLocationPayload = stockLocations.map((location) => ({
              locationId: location.id,
              quantity: Math.max(0, Math.round(Number(form.get(`stock-${location.id}`) ?? 0) || 0)),
            }));

            const saved = await saveItem({
              data: {
                id: item?.id,
                name,
                slug: slug || slugify(name),
                category: String(form.get("category") ?? "Cookies"),
                description: String(form.get("description") ?? ""),
                ingredients: String(form.get("ingredients") ?? ""),
                allergens: String(form.get("allergens") ?? ""),
                priceCents: Math.round(Number(form.get("price") ?? 0) * 100),
                inventoryQuantity:
                  stockLocations.length > 0
                    ? stockByLocationPayload.reduce((sum, row) => sum + row.quantity, 0)
                    : Number(form.get("inventoryQuantity") ?? 0),
                stockByLocation: stockLocations.length > 0 ? stockByLocationPayload : undefined,
                trackInventory: true,
                available: form.get("available") === "on",
                featured: false,
                imageKey,
                imageAlt: name || "Sweet Treats LR treat",
                stripeProductId: item?.stripeProductId,
                stripePriceId: item?.stripePriceId,
                sortOrder: Number(form.get("sortOrder") ?? item?.sortOrder ?? 100),
                weightOunces: Number(form.get("weightOunces") ?? 0) || 0,
                weightMaxOunces: Number(form.get("weightMaxOunces") ?? 0) || null,
                isShippable: form.get("isShippable") === "on",
                packSize: packSizeValue > 0 ? packSizeValue : null,
                packTareOunces: Number(packTare || 0) || 0,
                packContents:
                  packSizeValue > 0 ? packContentsState.filter((row) => row.quantity > 0) : [],
              },
            });
            toast.success("Item saved successfully!");
            await router.invalidate();
            await navigate({ to: "/admin/items/$id", params: { id: saved.id } });
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not save item.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <section className="panel admin-photo-panel">
          <img src={imageUrl(item?.imageKey)} alt="" className="admin-detail-photo" />
          <label className="field">
            <span>Photo</span>
            <input name="photo" type="file" accept="image/*" />
          </label>
          <input type="hidden" name="imageKey" value={item?.imageKey ?? ""} />
        </section>
        <section className="form-panel admin-form-panel">
          <div className="field-grid">
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                value={name}
                required
                onChange={(event) => {
                  setName(event.currentTarget.value);
                  if (!item?.slug) {
                    setSlug(slugify(event.currentTarget.value));
                  }
                }}
              />
            </label>
            <label className="field">
              <span>Slug</span>
              <input
                name="slug"
                value={slug}
                required
                onChange={(event) => setSlug(event.currentTarget.value)}
              />
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea name="description" rows={4} defaultValue={item?.description} required />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Category</span>
              <select name="category" defaultValue={normalizedCategory ?? "Cookies"}>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Price</span>
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={item ? item.priceCents / 100 : ""}
                required
              />
            </label>
          </div>
          <div className="field-grid">
            {stockLocations.length > 0 ? (
              <>
                {stockLocations.map((location) => (
                  <label className="field" key={location.id}>
                    <span>Stock at {location.name}</span>
                    <input
                      name={`stock-${location.id}`}
                      type="number"
                      min="0"
                      defaultValue={
                        stockByLocation.find((row) => row.locationId === location.id)?.quantity ?? 0
                      }
                    />
                    {packSizeValue > 0 ? (
                      <small className="field-hint">
                        Packs with contents ignore this — stock comes from the cookies inside.
                      </small>
                    ) : null}
                  </label>
                ))}
                <input
                  type="hidden"
                  name="inventoryQuantity"
                  value={stockByLocation.reduce((sum, row) => sum + row.quantity, 0)}
                />
              </>
            ) : (
              <label className="field">
                <span>Quantity available</span>
                <input
                  name="inventoryQuantity"
                  type="number"
                  min="0"
                  defaultValue={item?.inventoryQuantity ?? 0}
                />
                {packSizeValue > 0 ? (
                  <small className="field-hint">
                    Packs with contents ignore this number — stock comes from the cookies inside.
                  </small>
                ) : null}
              </label>
            )}
            <label className="field">
              <span>Sort order</span>
              <input name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 100} />
            </label>
          </div>
          {stockLocations.length > 0 ? (
            <small className="field-hint" style={{ display: "block", marginTop: "-6px" }}>
              Each spot has its own case. Web orders pull from the chosen pickup location (or the
              first location for shipped boxes) — count what&apos;s really on the shelf, including
              in-store sales.
            </small>
          ) : null}
          <label className="field">
            <span>Ingredients optional</span>
            <textarea name="ingredients" rows={3} defaultValue={item?.ingredients ?? ""} />
          </label>
          <label className="field">
            <span>Allergens optional</span>
            <input name="allergens" defaultValue={item?.allergens ?? ""} />
          </label>
          <label className="check-row">
            <input name="available" type="checkbox" defaultChecked={item?.available ?? true} />
            Show this item on the public menu when it is in stock
          </label>

          {/* Shipping & packs */}
          <fieldset className="form-section" style={{ marginTop: "8px", padding: "16px" }}>
            <legend>Shipping</legend>
            <div className="field-grid">
              <label className="field">
                <span>Weight per unit (oz)</span>
                <input
                  name="weightOunces"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={item?.weightOunces ?? 0}
                />
                <small className="field-hint">Used for USPS rate quotes.</small>
              </label>
              <label className="field">
                <span>Max weight (oz)</span>
                <input
                  name="weightMaxOunces"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={item?.weightMaxOunces ?? ""}
                />
                <small className="field-hint">
                  Optional upper bound; quotes use this so you never undercharge.
                </small>
              </label>
            </div>
            <label className="check-row">
              <input
                name="isShippable"
                type="checkbox"
                defaultChecked={item?.isShippable ?? true}
              />
              This item can be shipped (uncheck for cakes/shakes that are pickup-only)
            </label>
          </fieldset>

          <fieldset className="form-section" style={{ marginTop: "8px", padding: "16px" }}>
            <legend>Cookie pack (optional)</legend>
            <div className="field-grid">
              <label className="field">
                <span>Pack size (# of cookies)</span>
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={packSize}
                  onChange={(event) => setPackSize(event.currentTarget.value)}
                  placeholder="e.g. 6"
                />
                <small className="field-hint">
                  Leave blank for a single item. 3/6/9/12/18/24 all work.
                </small>
              </label>
              <label className="field">
                <span>Box weight (oz)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={packTare}
                  onChange={(event) => setPackTare(event.currentTarget.value)}
                  placeholder="e.g. 4"
                />
                <small className="field-hint">
                  Box/packaging weight added on top of the cookies inside.
                </small>
              </label>
            </div>

            {packSizeValue > 0 ? (
              <div style={{ marginTop: "12px" }}>
                <p style={{ fontSize: "0.86rem", margin: "0 0 8px" }}>
                  Cookies in this pack —{" "}
                  <strong className={packContentsTotal === packSizeValue ? "muted" : "sold-out"}>
                    {packContentsTotal} of {packSizeValue} filled
                  </strong>
                </p>
                {packContentsState.map((row, index) => {
                  const cookie = cookieOptions.find((option) => option.id === row.cookieItemId);
                  return (
                    <div
                      key={row.cookieItemId + index}
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}
                    >
                      <input
                        type="number"
                        min="1"
                        max="48"
                        value={row.quantity}
                        onChange={(event) => {
                          const next = [...packContentsState];
                          next[index] = {
                            ...row,
                            quantity: Math.max(1, Number(event.target.value) || 1),
                          };
                          setPackContentsState(next);
                        }}
                        style={{ width: "64px" }}
                        aria-label={`Quantity of ${cookie?.name ?? row.cookieItemId}`}
                      />
                      <span style={{ flex: 1 }}>× {cookie?.name ?? row.cookieItemId}</span>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          setPackContentsState(packContentsState.filter((_, i) => i !== index))
                        }
                        aria-label="Remove cookie from pack"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
                <div style={{ display: "flex", gap: "8px", alignItems: "end", marginTop: "8px" }}>
                  <label className="field" style={{ flex: 1, margin: 0 }}>
                    <span>Add a cookie</span>
                    <select
                      value=""
                      onChange={(event) => {
                        const cookieItemId = event.currentTarget.value;
                        if (!cookieItemId) {
                          return;
                        }
                        const existing = packContentsState.find(
                          (row) => row.cookieItemId === cookieItemId,
                        );
                        if (existing) {
                          setPackContentsState(
                            packContentsState.map((row) =>
                              row.cookieItemId === cookieItemId
                                ? { ...row, quantity: row.quantity + 1 }
                                : row,
                            ),
                          );
                        } else {
                          setPackContentsState([
                            ...packContentsState,
                            { cookieItemId, quantity: 1 },
                          ]);
                        }
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="">Pick a cookie…</option>
                      {cookieOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: "0.84rem", margin: "8px 0 0" }}>
                Set a pack size above to define which cookies this box contains.
              </p>
            )}
          </fieldset>

          {error ? <p className="sold-out">{error}</p> : null}
          <div className="inline-actions">
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save item"}
            </button>
            <Link to="/admin/items" className="text-button">
              Back to items
            </Link>
            {item ? (
              <button
                type="button"
                className="text-button danger-button"
                onClick={async () => {
                  await removeItem({ data: item.id });
                  toast.success("Item deleted successfully!");
                  await router.invalidate();
                  await navigate({ to: "/admin/items" });
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            ) : null}
          </div>
        </section>
      </form>
    </div>
  );
}
