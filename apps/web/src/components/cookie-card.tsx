import { Link } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { useCart, type CartMenuItem } from "../lib/cart";
import { formatMoney, imageUrl } from "../lib/format";

export function CookieCard({
  item,
  compact = false,
}: {
  item: CartMenuItem & {
    description: string;
    category: string;
    featured?: boolean;
    inventoryQuantity?: number;
    trackInventory?: boolean;
  };
  compact?: boolean;
}) {
  const cart = useCart();
  const categoryLabel = item.category === "Main Cookies" ? "Today's Batch" : item.category;
  const line = cart.lines.find((cartLine) => cartLine.id === item.id);
  const quantity = line?.quantity ?? 0;
  const maxQuantity =
    item.trackInventory && typeof item.inventoryQuantity === "number" ? item.inventoryQuantity : 24;
  const reachedLimit = quantity >= maxQuantity;
  const showLowStock =
    item.available &&
    item.trackInventory &&
    typeof item.inventoryQuantity === "number" &&
    item.inventoryQuantity <= 6;

  return (
    <article className="cookie-card flyer-product reveal-card">
      <Link to="/item/$id" params={{ id: item.id }} className="cookie-image-link">
        <img
          src={imageUrl(item.imageKey)}
          alt={item.name}
          className="cookie-image"
          loading="lazy"
          width={640}
          height={480}
        />
      </Link>
      <div className="cookie-card-body">
        <div className="cookie-card-top">
          <div>
            <p className="eyebrow">{categoryLabel || "Today's Batch"}</p>
            <h3>
              <Link to="/item/$id" params={{ id: item.id }} className="cookie-title-link">
                {item.name}
              </Link>
            </h3>
          </div>
          <strong>{formatMoney(item.priceCents)}</strong>
        </div>
        {!compact ? <p>{item.description}</p> : null}
        <div className="cookie-card-actions">
          <span className={item.available ? "availability" : "availability sold-out"}>
            {item.available
              ? item.trackInventory && typeof item.inventoryQuantity === "number"
                ? showLowStock
                  ? `Only ${item.inventoryQuantity} left`
                  : "Available today"
                : "Available today"
              : "Sold out"}
          </span>
          {quantity > 0 ? (
            <div className="card-stepper" aria-label={`${item.name} quantity in cart`}>
              <button
                type="button"
                aria-label={`Remove one ${item.name}`}
                onClick={() => cart.decrease(item.id)}
              >
                <Minus size={15} aria-hidden="true" />
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                aria-label={`Add one ${item.name}`}
                disabled={reachedLimit}
                onClick={() => cart.increase(item.id)}
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="icon-text-button"
              disabled={!item.available}
              onClick={() => {
                cart.addItem(item);
                toast.success(`${item.name} added`);
              }}
            >
              <Plus size={16} aria-hidden="true" />
              Add
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
