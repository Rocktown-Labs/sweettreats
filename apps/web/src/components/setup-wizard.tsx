import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, KeyRound, MapPin, Scale, Store, X } from "lucide-react";

import { getSetupStatus } from "../lib/api";
import { authClient } from "../lib/auth-client";

/**
 * Setup wizard on the admin Overview — a dismissible checklist that guides
 * the shop owner through first-time configuration.
 *
 * Dismissal is per-user (localStorage keyed by email): the developer skips
 * it once and never sees it again; the owner works through it until every
 * step auto-detects as done, at which point the card disappears entirely.
 *
 * Each step shows real data context — not just "pending vs done" but what
 * the current value is, so the owner knows exactly what to change.
 */

const DISMISS_KEY = "sweet-treats-admin-setup-dismissed";

type SetupStatus = {
  shipFromAddress: { street1: string; city: string; state: string } | null;
  unweightedCount: number;
  locationExample: string;
  locationsConfigured: boolean;
  stripeMode: "test" | "live" | null;
  shippoMode: "test" | "live" | null;
};

type Step = {
  icon: React.ReactNode;
  title: string;
  description: string;
  done: boolean;
  statusText: string;
  to: string;
};

function buildSteps(status: SetupStatus): Step[] {
  const stripeLive = status.stripeMode === "live";
  const shippoLive = status.shippoMode === "live";

  return [
    {
      icon: <Store size={18} aria-hidden="true" />,
      title: "Set your bakery's address",
      description:
        "Where orders ship from. A wrong address means wrong shipping quotes at checkout.",
      done: Boolean(status.shipFromAddress),
      statusText: status.shipFromAddress
        ? `Currently: ${status.shipFromAddress.street1}, ${status.shipFromAddress.city}, ${status.shipFromAddress.state} — update if this isn't your real bakery`
        : "Not set — shipping quotes will fail",
      to: "/admin/shipping",
    },
    {
      icon: <Scale size={18} aria-hidden="true" />,
      title: "Weigh your cookies",
      description:
        "Weigh 3 cookies together, divide by 3, and enter that average as each item's weight. Powers shipping rates.",
      done: status.unweightedCount === 0,
      statusText:
        status.unweightedCount === 0
          ? "All items have weights"
          : `${status.unweightedCount} item${status.unweightedCount === 1 ? "" : "s"} still need a weight`,
      to: "/admin/items",
    },
    {
      icon: <MapPin size={18} aria-hidden="true" />,
      title: "Add real pickup addresses",
      description:
        "Give each pickup location a street address customers can find. Replace any placeholder descriptions.",
      done: status.locationsConfigured,
      statusText: status.locationsConfigured
        ? "All locations have real addresses"
        : status.locationExample
          ? `Example: "${status.locationExample}" — looks like a placeholder`
          : "No locations yet",
      to: "/admin/locations",
    },
    {
      icon: <KeyRound size={18} aria-hidden="true" />,
      title: "Connect your accounts",
      description:
        "Paste your live Stripe and Shippo keys to accept real payments and ship real orders.",
      done: stripeLive && shippoLive,
      statusText: [
        status.stripeMode
          ? `Stripe: ${stripeLive ? "✓ LIVE" : "TEST MODE"}`
          : "Stripe: not connected",
        status.shippoMode
          ? `Shippo: ${shippoLive ? "✓ LIVE" : "TEST MODE"}`
          : "Shippo: not connected",
      ].join(" · "),
      to: "/admin/settings",
    },
  ];
}

export function SetupWizard() {
  const fetchStatus = useServerFn(getSetupStatus);
  const { data: session } = authClient.useSession();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  // Fetch setup status
  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchStatus]);

  // Check per-user dismissal once we know who's signed in
  useEffect(() => {
    if (!session?.user?.email) return;
    const key = `${DISMISS_KEY}:${session.user.email}`;
    setDismissed(window.localStorage.getItem(key) === "1");
  }, [session?.user?.email]);

  const dismiss = () => {
    if (session?.user?.email) {
      window.localStorage.setItem(`${DISMISS_KEY}:${session.user.email}`, "1");
    }
    setDismissed(true);
  };

  // Still loading or dismissed → nothing to show
  if (dismissed !== false || !status) {
    return null;
  }

  const steps = buildSteps(status);
  const doneCount = steps.filter((step) => step.done).length;

  // Everything done → the wizard earns its own disappearance
  if (doneCount === steps.length) {
    return null;
  }

  return (
    <section
      className="panel"
      style={{
        padding: "0",
        marginBottom: "18px",
        border: "1.5px solid #d8ae6a",
        overflow: "hidden",
      }}
      aria-label="Shop setup guide"
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #241408 0%, #3d2a18 100%)",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#d8ae6a",
              fontWeight: 600,
            }}
          >
            Get your shop ready
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: "0.88rem",
              color: "#fff8e7",
              opacity: 0.85,
            }}
          >
            {doneCount} of {steps.length} steps complete
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss setup guide"
          title="Skip setup for now"
          style={{
            background: "none",
            border: "none",
            color: "#fff8e7",
            opacity: 0.6,
            cursor: "pointer",
            padding: "4px",
            lineHeight: 1,
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: "3px", background: "#f1e2cc" }}>
        <div
          style={{
            height: "100%",
            width: `${(doneCount / steps.length) * 100}%`,
            background: "linear-gradient(90deg, #d8ae6a, #b9823b)",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Steps */}
      <div style={{ padding: "6px 0" }}>
        {steps.map((step, index) => (
          <Link
            key={step.title}
            to={step.to}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "12px 18px",
              borderBottom: index < steps.length - 1 ? "1px solid #f1e2cc" : "none",
              textDecoration: "none",
              color: "inherit",
              opacity: step.done ? 0.5 : 1,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                marginTop: "1px",
                color: step.done ? "#2e7d32" : "#b9823b",
              }}
            >
              {step.done ? (
                <CheckCircle2 size={18} aria-hidden="true" />
              ) : (
                <Circle size={18} aria-hidden="true" style={{ opacity: 0.4 }} />
              )}
            </span>

            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "#241408",
                }}
              >
                {step.title}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "#6e5c47",
                  lineHeight: 1.4,
                  marginTop: "2px",
                }}
              >
                {step.description}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: "0.76rem",
                  color: step.done ? "#2e7d32" : "#c0392b",
                  marginTop: "4px",
                  fontWeight: 500,
                }}
              >
                {step.done ? "✓ " : step.statusText ? "" : "○ "}
                {step.statusText}
              </span>
            </span>

            {!step.done && (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: "0.78rem",
                  color: "#b9823b",
                  fontWeight: 600,
                  marginTop: "4px",
                }}
              >
                Go →
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 18px 12px",
          borderTop: "1px solid #f1e2cc",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          style={{
            background: "none",
            border: "none",
            color: "#8c6f4a",
            fontSize: "0.78rem",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Skip for now — I'll come back to it
        </button>
      </div>
    </section>
  );
}
