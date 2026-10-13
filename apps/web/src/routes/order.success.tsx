import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";
import { authClient } from "../lib/auth-client";

import { getOrder } from "../lib/api";
import { isCurrentUserAdmin } from "../lib/auth";
import { formatMoney } from "../lib/format";

export const Route = createFileRoute("/order/success")({
  validateSearch: z.object({
    orderId: z.string().optional(),
    t: z.string().optional(),
    session_id: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({
    orderId: search.orderId,
    token: search.t,
    sessionId: search.session_id,
  }),
  loader: ({ deps }) =>
    deps.orderId
      ? getOrder({ data: { id: deps.orderId, token: deps.token, sessionId: deps.sessionId } })
      : null,
  component: SuccessPage,
});

function SuccessPage() {
  const order = Route.useLoaderData();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(6);
  const { data: session } = authClient.useSession();
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!session?.user) {
      return;
    }
    let cancelled = false;
    checkAdmin()
      .then((result) => {
        if (!cancelled) {
          setIsAdmin(Boolean(result));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, checkAdmin]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
          {order.pickupLocationName ? (
            <div
              style={{
                margin: "16px auto",
                maxWidth: "420px",
                padding: "12px 16px",
                background: "rgba(255, 255, 255, 0.65)",
                border: "1.5px solid #d8ae6a",
                borderRadius: "10px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 700,
                  color: "#1b0f08",
                }}
              >
                <MapPin size={16} style={{ color: "#b9823b" }} aria-hidden="true" />
                <span>Pickup location: {order.pickupLocationName}</span>
              </div>
              {order.pickupLocation?.address ? (
                <p style={{ margin: "4px 0 0 22px", fontSize: "0.88rem", color: "#4a2a12" }}>
                  {order.pickupLocation.address}
                </p>
              ) : null}
              {order.pickupLocation?.instructions ? (
                <p
                  style={{
                    margin: "4px 0 0 22px",
                    fontSize: "0.82rem",
                    color: "#6e4422",
                    fontStyle: "italic",
                  }}
                >
                  {order.pickupLocation.instructions}
                </p>
              ) : null}
            </div>
          ) : null}
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
