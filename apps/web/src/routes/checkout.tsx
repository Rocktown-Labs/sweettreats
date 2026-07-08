import { Link, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { useCart } from "../lib/cart";
import { createOrder, getPickupAvailability } from "../lib/api";
import { formatMoney } from "../lib/format";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/checkout")({
  loader: () => getPickupAvailability(),
  component: CheckoutPage,
  pendingComponent: CheckoutPending,
});

function CheckoutPending() {
  return (
    <main className="page">
      <div className="section-head">
        <div>
          <p
            className="eyebrow skeleton"
            style={{ width: "80px", height: "14px", marginBottom: "8px" }}
          ></p>
          <h1
            className="page-title skeleton"
            style={{ width: "200px", height: "48px", marginBottom: "8px" }}
          ></h1>
          <p className="skeleton skeleton-text" style={{ width: "280px" }}></p>
        </div>
      </div>
      <div className="layout-two">
        <section className="form-panel">
          <div className="field-grid">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="field">
                <div
                  className="skeleton"
                  style={{ width: "80px", height: "14px", marginBottom: "8px" }}
                ></div>
                <div className="skeleton" style={{ width: "100%", height: "38px" }}></div>
              </div>
            ))}
          </div>
        </section>
        <aside className="panel">
          <div className="skeleton skeleton-title" style={{ width: "100px" }}></div>
          <div className="skeleton skeleton-text" style={{ width: "80%" }}></div>
          <div
            className="skeleton skeleton-title"
            style={{ width: "120px", height: "32px", marginTop: "12px" }}
          ></div>
          <div
            className="skeleton skeleton-button"
            style={{ width: "100%", marginTop: "16px" }}
          ></div>
        </aside>
      </div>
    </main>
  );
}

function CheckoutPage() {
  const pickup = Route.useLoaderData();
  const cart = useCart();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const submitOrder = useServerFn(createOrder);
  const [error, setError] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  return (
    <main className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Pickup details</p>
          <h1 className="page-title">Send order</h1>
          <p className="muted">
            Continue as a guest, or <Link to="/sign-in">log in</Link> before ordering to keep order
            history.
          </p>
        </div>
      </div>
      <form
        className="layout-two"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSubmitting(true);
          const form = new FormData(event.currentTarget);
          try {
            const result = await submitOrder({
              data: {
                name: String(form.get("name") ?? ""),
                email: String(form.get("email") ?? ""),
                phone: String(form.get("phone") ?? ""),
                pickupDate: String(form.get("pickupDate") ?? ""),
                pickupTime: String(form.get("pickupTime") ?? ""),
                notes: String(form.get("notes") ?? ""),
                items: cart.lines.map((line) => ({ id: line.id, quantity: line.quantity })),
              },
            });
            cart.clear();
            if (result.checkoutUrl) {
              window.location.href = result.checkoutUrl;
            } else {
              await navigate({ to: "/order/success", search: { orderId: result.orderId } });
            }
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not place order.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <section className="form-panel">
          <div className="field-grid">
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                required
                autoComplete="name"
                defaultValue={session?.user?.name || ""}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                name="email"
                required
                type="email"
                autoComplete="email"
                defaultValue={session?.user?.email || ""}
              />
            </label>
            <label className="field">
              <span>Phone</span>
              <input
                name="phone"
                required
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                pattern="[0-9()+\\-\\s]{7,20}"
                title="Use a real phone number so the shop can confirm pickup."
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(
                    /[^0-9()+\-\s]/g,
                    "",
                  );
                }}
              />
            </label>
            <label className="field">
              <span>Pickup date</span>
              <input
                name="pickupDate"
                required
                type="date"
                min={pickup.pickupDate}
                defaultValue={pickup.pickupDate}
              />
            </label>
            <label className="field">
              <span>Pickup time</span>
              <input
                name="pickupTime"
                required
                type="time"
                min="11:00"
                max="23:00"
                className="compact-input"
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={4} />
            </label>
          </div>
          {error ? <p className="sold-out">{error}</p> : null}
        </section>
        <aside className="panel">
          <p className="eyebrow">Order summary</p>
          {cart.lines.map((line) => (
            <p key={line.id}>
              {line.quantity} x {line.name}
            </p>
          ))}
          <h2>{formatMoney(cart.subtotalCents)}</h2>
          <button
            type="submit"
            className="primary-button"
            disabled={!cart.lines.length || isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Send order"}
          </button>
        </aside>
      </form>
    </main>
  );
}
