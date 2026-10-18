import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag, Mail, CheckCircle2 } from "lucide-react";

import { getAdminAbandonedCarts } from "../lib/api";
import { formatMoney } from "../lib/format";

export const Route = createFileRoute("/admin/carts")({
  loader: () => getAdminAbandonedCarts(),
  component: AdminCartsPage,
});

function timeAgo(iso: string): string {
  const seconds = Math.max(
    0,
    (Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime()) / 1000,
  );
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min ago`;
  }
  if (seconds < 86400) {
    return `${Math.round(seconds / 3600)} h ago`;
  }
  return `${Math.round(seconds / 86400)} d ago`;
}

function AdminCartsPage() {
  const carts = Route.useLoaderData();

  const active = carts.filter((cart) => !cart.recoveredAt);
  const recovered = carts.filter((cart) => Boolean(cart.recoveredAt));

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Abandoned carts</h1>
          <p className="muted" style={{ marginTop: "4px" }}>
            Carts that went quiet for a day get one win-back email (when the customer is signed in
            and we have an address). A finished order marks the cart recovered.
          </p>
        </div>
      </div>

      {active.length === 0 ? (
        <section className="panel empty-state">
          <p>No abandoned carts right now. 🍪</p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {active.map((cart) => (
            <section className="panel" key={cart.id} style={{ padding: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <ShoppingBag size={18} aria-hidden="true" style={{ color: "#b9823b" }} />
                <strong style={{ flex: 1 }}>{cart.email || "Guest (no email on file)"}</strong>
                <span className="muted" style={{ fontSize: "0.84rem" }}>
                  Last seen {timeAgo(cart.lastSeenAt)}
                </span>
                <strong>{formatMoney(cart.subtotalCents)}</strong>
                {cart.abandonedEmailSentAt ? (
                  <span
                    style={{
                      display: "inline-flex",
                      gap: "4px",
                      alignItems: "center",
                      fontSize: "0.8rem",
                      color: "#2e7d32",
                    }}
                  >
                    <Mail size={13} aria-hidden="true" /> win-back sent
                  </span>
                ) : cart.email ? (
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    win-back pending (24h quiet)
                  </span>
                ) : null}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "0.88rem", color: "#4a2a12" }}>
                {cart.lines.map((line, index) => (
                  <span key={`${cart.id}-${index}`}>
                    {index > 0 ? ", " : ""}
                    {line.quantity}× {line.name}
                  </span>
                ))}
              </p>
            </section>
          ))}
        </div>
      )}

      {recovered.length > 0 ? (
        <>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.15rem",
              margin: "26px 0 10px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <CheckCircle2 size={16} aria-hidden="true" style={{ color: "#2e7d32" }} />
            Recovered ({recovered.length})
          </h2>
          <div style={{ display: "grid", gap: "8px" }}>
            {recovered.slice(0, 20).map((cart) => (
              <section
                className="panel"
                key={cart.id}
                style={{ padding: "12px 16px", opacity: 0.75 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <strong style={{ flex: 1 }}>{cart.email || "Guest"}</strong>
                  <span className="muted" style={{ fontSize: "0.82rem" }}>
                    recovered {cart.recoveredAt ? timeAgo(cart.recoveredAt) : ""}
                  </span>
                  <strong>{formatMoney(cart.subtotalCents)}</strong>
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
