import { Link, createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { useCart } from "../lib/cart";
import { formatMoney, imageUrl } from "../lib/format";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const cart = useCart();

  return (
    <main className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Your box</p>
          <h1 className="page-title">Cart</h1>
        </div>
        <Link to="/menu" className="text-button">
          Add treats
        </Link>
      </div>
      <div className="layout-two">
        <section className="panel">
          {cart.lines.length === 0 ? (
            <p className="muted">Your cart is empty.</p>
          ) : (
            cart.lines.map((line) => (
              <div className="cart-line" key={line.id}>
                <img src={imageUrl(line.imageKey)} alt={line.name} />
                <div>
                  <div className="cookie-card-top">
                    <strong>{line.name}</strong>
                    <span>{formatMoney(line.priceCents * line.quantity)}</span>
                  </div>
                  <div className="quantity-row">
                    <div className="stepper">
                      <button
                        type="button"
                        aria-label={`Remove one ${line.name}`}
                        onClick={() => cart.decrease(line.id)}
                      >
                        -
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${line.name}`}
                        onClick={() => cart.increase(line.id)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`Remove ${line.name} from cart`}
                      onClick={() => cart.removeItem(line.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
        <aside className="panel">
          <p className="eyebrow">Subtotal</p>
          <h2 className="section-title">{formatMoney(cart.subtotalCents)}</h2>
          <p className="muted">
            The shop receives the request and confirms pickup. Online payment can be connected
            later.
          </p>
          {cart.lines.length > 0 ? (
            <Link to="/checkout" className="primary-button">
              Checkout
            </Link>
          ) : (
            <button type="button" className="primary-button" disabled>
              Checkout
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}
