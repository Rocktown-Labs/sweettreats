import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Eye, KeyRound, MapPin, Scale, Store, X } from "lucide-react";

import { getSetupStatus } from "../lib/api";
import { authClient } from "../lib/auth-client";

/**
 * Setup wizard on the admin Overview — a dismissible checklist that guides
 * the shop owner through first-time configuration.
 *
 * Three step states:
 *   ✓ done    — genuinely auto-detected (live keys, real addresses)
 *   ◐ review  — something's set, but it's placeholder data the owner needs
 *               to verify or replace (dev-seeded address/weights)
 *   ○ pending — nothing configured at all
 *
 * Address and weight steps intentionally never auto-green — the app can't
 * distinguish "the owner confirmed this" from "the dev seeded a placeholder."
 * They show as amber "verify" with the current values visible so the owner
 * can see at a glance that the address says "Searcy" and needs to be the
 * real bakery. The wizard stays until dismissed or all steps are green.
 *
 * Per-user dismissal (localStorage keyed by email): the developer clicks
 * "Skip" once; the owner works through it.
 */

const DISMISS_KEY = "sweet-treats-admin-setup-dismissed";

type SetupStatus = {
  shipFromAddress: { street1: string; city: string; state: string } | null;
  unweightedCount: number;
  allWeightsSeeded: boolean;
  locationExample: string;
  locationsConfigured: boolean;
  stripeMode: "test" | "live" | null;
  shippoMode: "test" | "live" | null;
};

type StepState = "done" | "review" | "pending";

type Step = {
  icon: React.ReactNode;
  title: string;
  description: string;
  state: StepState;
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
      // Never auto-detect as done — the owner must confirm this is right.
      state: status.shipFromAddress ? "review" : "pending",
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
      // Never auto-detect as done — seeded weights are placeholder until
      // the owner enters real measurements.
      state: status.unweightedCount === 0 ? "review" : "pending",
      statusText:
        status.unweightedCount > 0
          ? `${status.unweightedCount} item${status.unweightedCount === 1 ? "" : "s"} still need${status.unweightedCount === 1 ? "s" : ""} a weight`
          : status.allWeightsSeeded
            ? "All items have placeholder weights — verify by weighing 3 and dividing by 3"
            : "All items have weights — verify they're accurate",
      to: "/admin/items",
    },
    {
      icon: <MapPin size={18} aria-hidden="true" />,
      title: "Add real pickup addresses",
      description:
        "Give each pickup location a street address customers can find. Replace any placeholder descriptions.",
      state: status.locationsConfigured ? "done" : "review",
      statusText: status.locationsConfigured
        ? "✓ All locations have real addresses"
        : status.locationExample
          ? `"${status.locationExample}" — looks like a placeholder`
          : "No locations yet",
      to: "/admin/locations",
    },
    {
      icon: <KeyRound size={18} aria-hidden="true" />,
      title: "Connect your accounts",
      description:
        "Paste your live Stripe and Shippo keys to accept real payments and ship real orders.",
      state: stripeLive && shippoLive ? "done" : "review",
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

function stepStateLabel(state: StepState): string {
  switch (state) {
    case "done":
      return "done";
    case "review":
      return "needs your review";
    case "pending":
      return "not set";
  }
}

function stepStateColor(state: StepState): string {
  switch (state) {
    case "done":
      return "#2e7d32";
    case "review":
      return "#d4a017";
    case "pending":
      return "#b09878";
  }
}

export function SetupWizard() {
  const fetchStatus = useServerFn(getSetupStatus);
  const { data: session } = authClient.useSession();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

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

  if (dismissed !== false || !status) {
    return null;
  }

  const steps = buildSteps(status);
  const doneCount = steps.filter((step) => step.state === "done").length;
  const reviewCount = steps.filter((step) => step.state === "review").length;

  // The wizard earns its disappearance when everything is genuinely done
  // — but address and weights never auto-green, so the escape is dismissal.
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
            {doneCount === steps.length
              ? "All done!"
              : reviewCount > 0
                ? `${doneCount} done · ${reviewCount} need${reviewCount === 1 ? "s" : ""} your review`
                : "Let's set things up"}
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

      {/* Progress bar: green for done, amber for review */}
      <div style={{ height: "3px", background: "#f1e2cc", display: "flex" }}>
        <div
          style={{
            height: "100%",
            width: `${(doneCount / steps.length) * 100}%`,
            background: "#2e7d32",
            transition: "width 0.3s ease",
          }}
        />
        <div
          style={{
            height: "100%",
            width: `${(reviewCount / steps.length) * 100}%`,
            background: "#d4a017",
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
            }}
          >
            {/* Icon + state */}
            <span
              style={{
                flexShrink: 0,
                marginTop: "1px",
                color: stepStateColor(step.state),
              }}
            >
              {step.state === "done" ? (
                <CheckCircle2 size={18} aria-hidden="true" />
              ) : step.state === "review" ? (
                <Eye size={18} aria-hidden="true" />
              ) : (
                <Circle size={18} aria-hidden="true" style={{ opacity: 0.35 }} />
              )}
            </span>

            {/* Content */}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    color: "#241408",
                  }}
                >
                  {step.title}
                </span>
                {step.state !== "done" && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 600,
                      color: stepStateColor(step.state),
                      background: `${stepStateColor(step.state)}18`,
                      padding: "1px 8px",
                      borderRadius: "999px",
                      border: `1px solid ${stepStateColor(step.state)}33`,
                    }}
                  >
                    {stepStateLabel(step.state)}
                  </span>
                )}
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
                  color: stepStateColor(step.state),
                  marginTop: "4px",
                  fontWeight: 500,
                }}
              >
                {step.state === "done" ? "✓ " : ""}
                {step.statusText}
              </span>
            </span>

            {step.state !== "done" && (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: "0.78rem",
                  color: "#b9823b",
                  fontWeight: 600,
                  marginTop: "4px",
                }}
              >
                {step.state === "review" ? "Verify →" : "Go →"}
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
