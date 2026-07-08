import { Link, useNavigate, useRouter, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminNav } from "../components/admin-nav";
import { deleteMenuItem, getAdminMenuItem, saveMenuItem, uploadMenuPhoto } from "../lib/api";
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
  const normalizedCategory = item?.category === "Main Cookies" ? "Cookies" : item?.category;
  const categoryOptions = useMemo(
    () =>
      normalizedCategory && !categories.includes(normalizedCategory)
        ? [...categories, normalizedCategory]
        : categories,
    [normalizedCategory],
  );

  return (
    <main className="page admin-page">
      <AdminNav />
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
                  inventoryQuantity: Number(form.get("inventoryQuantity") ?? 0),
                  trackInventory: true,
                  available: form.get("available") === "on",
                  featured: false,
                  imageKey,
                  imageAlt: name || "Sweet Treats LR treat",
                  stripeProductId: item?.stripeProductId,
                  stripePriceId: item?.stripePriceId,
                  sortOrder: Number(form.get("sortOrder") ?? item?.sortOrder ?? 100),
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
              <label className="field">
                <span>Quantity available</span>
                <input
                  name="inventoryQuantity"
                  type="number"
                  min="0"
                  defaultValue={item?.inventoryQuantity ?? 0}
                />
              </label>
              <label className="field">
                <span>Sort order</span>
                <input name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 100} />
              </label>
            </div>
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
    </main>
  );
}
