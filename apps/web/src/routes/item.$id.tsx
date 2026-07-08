import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useCart } from "../lib/cart";
import { formatMoney, imageUrl } from "../lib/format";
import { getMenuItem } from "../lib/api";

export const Route = createFileRoute("/item/$id")({
  loader: ({ params }) => getMenuItem({ data: params.id }),
  component: ItemPage,
});

function ItemPage() {
  const item = Route.useLoaderData();
  const [quantity, setQuantity] = useState(1);
  const cart = useCart();

  if (!item) {
    return <main className="page">Cookie not found.</main>;
  }

  const categoryLabel = item.category === "Main Cookies" ? "Today's Batch" : item.category;
  const currentLine = cart.lines.find((line) => line.id === item.id);
  const inCartQuantity = currentLine?.quantity ?? 0;
  const maxQuantity =
    item.trackInventory && typeof item.inventoryQuantity === "number" ? item.inventoryQuantity : 24;
  const canAddMore = item.available && inCartQuantity + quantity <= maxQuantity;

  return (
    <main className="page">
      <div className="layout-two">
        <section className="hero-flyer">
          <img src={imageUrl(item.imageKey)} alt={item.imageAlt} className="cookie-image" />
        </section>
        <aside className="panel">
          <p className="eyebrow">{categoryLabel}</p>
          <h1 className="page-title">{item.name}</h1>
          <p className="hero-copy">{item.description}</p>
          <p>
            <strong>{formatMoney(item.priceCents)}</strong>
          </p>
          <p>
            <strong>Ingredients:</strong> {item.ingredients}
          </p>
          <p>
            <strong>Allergens:</strong> {item.allergens || "Ask before ordering"}
          </p>
          <div className="quantity-row">
            <div className="stepper">
              <button
                type="button"
                aria-label={`Remove one ${item.name}`}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                aria-label={`Add one ${item.name}`}
                disabled={quantity + inCartQuantity >= maxQuantity}
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={!canAddMore}
              onClick={() => {
                cart.addItem(item, quantity);
                toast.success(`${item.name} added`);
              }}
            >
              <ShoppingBag size={18} aria-hidden="true" />
              Add to cart
            </button>
          </div>
          <p className={item.available ? "availability" : "availability sold-out"}>
            {item.available
              ? item.trackInventory && typeof item.inventoryQuantity === "number"
                ? `${Math.max(0, item.inventoryQuantity - inCartQuantity)} left`
                : "Available today"
              : "Sold out"}
          </p>
        </aside>
      </div>
    </main>
  );
}
