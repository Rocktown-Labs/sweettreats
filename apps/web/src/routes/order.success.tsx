import { Link, createFileRoute, useNavigate, useLoaderData } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";

import { getOrder } from "../lib/api";
import { formatMoney } from "../lib/format";

export const Route = createFileRoute("/order/success")({
  validateSearch: z.object({
    orderId: z.string().optional(),
    session_id: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ orderId: search.orderId, sessionId: search.session_id }),
  loader: ({ deps }) =>
    deps.orderId ? getOrder({ data: { id: deps.orderId, sessionId: deps.sessionId } }) : null,
  component: SuccessPage,
});

function SuccessPage() {
  const order = Route.useLoaderData();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(6);
  const { data: session } = authClient.useSession();
  const rootData = useLoaderData({ from: "__root__" }) as { adminEmails?: string[] };

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin =
    session?.user?.email && rootData?.adminEmails?.includes(session.user.email.toLowerCase());

  useEffect(() => {
    if (seconds <= 0) {
      if (isAdmin) {
        navigate({ to: "/admin/orders" });
      } else if (session?.user) {
        navigate({ to: "/account/orders" });
      } else {
        navigate({ to: "/menu" });
      }
    }
  }, [seconds, session, isAdmin, navigate]);

  if (!order) {
    return <main className="page">Order not found.</main>;
  }

  return (
    <main className="page">
      <section className="hero-flyer">
        <div className="hero-inner">
          <span className="tagline">Order received</span>
          <h1 className="hero-title">{order.orderNumber}</h1>
          <p className="hero-copy">
            Pickup is requested for {order.pickupDate} at {order.pickupTime}. The shop will confirm
            before the box is final.
          </p>
          <div style={{ marginBottom: "16px" }}>
            {order.items.map((item) => (
              <p key={item.id}>
                {item.quantity} x {item.itemNameSnapshot} · {formatMoney(item.lineTotalCents)}
              </p>
            ))}
          </div>
          <h2>{formatMoney(order.subtotalCents)}</h2>
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              marginTop: "20px",
              flexWrap: "wrap",
            }}
          >
            <Link to="/menu" className="primary-button outline-button">
              Return to menu
            </Link>
            {isAdmin ? (
              <Link to="/admin/orders" className="primary-button">
                Manage orders
              </Link>
            ) : session?.user ? (
              <Link to="/account/orders" className="primary-button">
                View your orders
              </Link>
            ) : null}
          </div>
          <p
            className="muted"
            style={{ marginTop: "24px", fontStyle: "italic", fontSize: "0.9rem" }}
          >
            Redirecting you in {seconds} seconds...
          </p>
        </div>
      </section>
    </main>
  );
}
