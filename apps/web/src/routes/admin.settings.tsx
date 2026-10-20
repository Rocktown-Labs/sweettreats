import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { KeyRound, Save, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { getIntegrationSettings, saveIntegrationKeys, syncAllItemsToStripe } from "../lib/api";

export const Route = createFileRoute("/admin/settings")({
  loader: () => getIntegrationSettings(),
  component: AdminSettingsPage,
});

type KeyStatus = {
  configured: boolean;
  source: "sheet" | "env" | "none";
  last4: string;
};

type IntegrationSettings = {
  stripe: {
    secret: KeyStatus;
    publishable: KeyStatus;
    webhook: KeyStatus;
    mode: "test" | "live" | null;
  };
  shippo: { api: KeyStatus };
};

type FieldId = "stripeSecret" | "stripePublishable" | "stripeWebhook" | "shippoApi";

const FIELDS: {
  id: FieldId;
  label: string;
  placeholder: string;
  hint: string;
  secret: boolean;
  getStatus: (settings: IntegrationSettings) => KeyStatus;
}[] = [
  {
    id: "stripeSecret",
    label: "Stripe secret key",
    placeholder: "sk_live_… (or sk_test_…)",
    hint: "Required for card checkout. Validated against Stripe before saving.",
    secret: true,
    getStatus: (s) => s.stripe.secret,
  },
  {
    id: "stripePublishable",
    label: "Stripe publishable key",
    placeholder: "pk_live_… (or pk_test_…)",
    hint: "Format-checked only — it's public information.",
    secret: false,
    getStatus: (s) => s.stripe.publishable,
  },
  {
    id: "stripeWebhook",
    label: "Stripe webhook signing secret",
    placeholder: "whsec_…",
    hint: "From the webhook endpoint at sweettreatslr.com/api/stripe/webhook (Stripe Dashboard → Developers → Webhooks).",
    secret: true,
    getStatus: (s) => s.stripe.webhook,
  },
  {
    id: "shippoApi",
    label: "Shippo API token",
    placeholder: "shippo_live_… (or shippo_test_…)",
    hint: "Powers shipping rates at checkout and the rate-compare tools. Validated against Shippo before saving.",
    secret: true,
    getStatus: (s) => s.shippo.api,
  },
];

function StatusBadge({ status }: { status: KeyStatus }) {
  if (!status.configured) {
    return <span style={badgeStyle("#7a6a55", "#f3ead9")}>not set</span>;
  }
  if (status.source === "sheet") {
    return (
      <span style={badgeStyle("#1b5e20", "#e8f5e9")}>
        <ShieldCheck
          size={11}
          aria-hidden="true"
          style={{ marginRight: "3px", verticalAlign: "-1px" }}
        />
        set here ·{status.last4 ? ` …${status.last4}` : ""}
      </span>
    );
  }
  return (
    <span style={badgeStyle("#8a6d1a", "#fdf3d7")}>
      from deploy ·{status.last4 ? ` …${status.last4}` : ""}
    </span>
  );
}

function AdminSettingsPage() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  const saveKeys = useServerFn(saveIntegrationKeys);
  const syncNow = useServerFn(syncAllItemsToStripe);

  const [settings, setSettings] = useState<IntegrationSettings>(initial);
  const [values, setValues] = useState<Record<FieldId, string>>({
    stripeSecret: "",
    stripePublishable: "",
    stripeWebhook: "",
    shippoApi: "",
  });
  const [clear, setClear] = useState<Record<FieldId, boolean>>({
    stripeSecret: false,
    stripePublishable: false,
    stripeWebhook: false,
    shippoApi: false,
  });
  const [isSaving, setSaving] = useState(false);
  const [isSyncing, setSyncing] = useState(false);

  useEffect(() => {
    if (router.state.location.pathname === "/admin/settings") return;
  }, [router.state.location.pathname]);

  const refresh = async () => {
    const fresh = await getIntegrationSettings();
    setSettings(fresh);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string | undefined> = {};
      for (const field of FIELDS) {
        if (clear[field.id]) {
          payload[field.id] = "";
        } else if (values[field.id].trim()) {
          payload[field.id] = values[field.id].trim();
        }
      }
      if (Object.keys(payload).length === 0) {
        toast.info("Nothing to save — enter a key or check a clear box.");
        return;
      }

      const result = await saveKeys({ data: payload });
      if (result.stripeSynced) {
        toast.success(
          `Keys saved. Stripe synced ${result.stripeSynced.synced} of ${result.stripeSynced.total} menu items.`,
        );
      } else {
        toast.success("Keys saved.");
      }
      setValues({
        stripeSecret: "",
        stripePublishable: "",
        stripeWebhook: "",
        shippoApi: "",
      });
      setClear({
        stripeSecret: false,
        stripePublishable: false,
        stripeWebhook: false,
        shippoApi: false,
      });
      await refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save keys.");
    } finally {
      setSaving(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const result = await syncNow();
      if (result.success) {
        toast.success(`Synced ${result.synced} of ${result.total} menu items to Stripe.`);
      } else {
        toast.error(result.message ?? "Stripe is not configured yet.");
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Integrations</h1>
          <p className="muted" style={{ marginTop: "4px" }}>
            Connect Stripe and Shippo by pasting keys here — no redeploys. Keys are validated live,
            stored encrypted, and take effect the moment you save.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          style={{ background: "#6b5847" }}
          onClick={runSync}
          disabled={isSyncing}
        >
          <RefreshCw size={16} aria-hidden="true" style={{ marginRight: "6px" }} />
          {isSyncing ? "Syncing…" : "Sync items to Stripe"}
        </button>
      </div>

      <section className="panel" style={{ padding: "18px", maxWidth: "720px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "14px",
          }}
        >
          <KeyRound size={18} aria-hidden="true" style={{ color: "#b9823b" }} />
          <strong>API keys</strong>
          {settings.stripe.mode ? (
            <span
              style={badgeStyle(
                settings.stripe.mode === "live" ? "#1b5e20" : "#5e4b8a",
                settings.stripe.mode === "live" ? "#e8f5e9" : "#efe9f7",
              )}
            >
              Stripe {settings.stripe.mode.toUpperCase()} MODE
            </span>
          ) : null}
        </div>

        {FIELDS.map((field) => {
          const status = field.getStatus(settings);
          return (
            <div
              key={field.id}
              style={{
                display: "grid",
                gap: "6px",
                padding: "14px 0",
                borderBottom: "1px solid #f1e2cc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <label htmlFor={`settings-${field.id}`} style={{ fontWeight: 600, flex: 1 }}>
                  {field.label}
                </label>
                <StatusBadge status={status} />
              </div>
              <input
                id={`settings-${field.id}`}
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                placeholder={field.placeholder}
                value={values[field.id]}
                onChange={(event) => {
                  setValues({ ...values, [field.id]: event.target.value });
                  if (clear[field.id]) {
                    setClear({ ...clear, [field.id]: false });
                  }
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  alignItems: "baseline",
                }}
              >
                <small className="field-hint" style={{ flex: 1 }}>
                  {field.hint}
                </small>
                {status.configured ? (
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "#c0392b",
                      display: "inline-flex",
                      gap: "5px",
                      alignItems: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={clear[field.id]}
                      onChange={(event) => setClear({ ...clear, [field.id]: event.target.checked })}
                    />
                    clear
                  </label>
                ) : null}
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: "16px" }}>
          <button type="button" className="primary-button" onClick={save} disabled={isSaving}>
            <Save size={16} aria-hidden="true" style={{ marginRight: "6px" }} />
            {isSaving ? "Saving…" : "Save keys"}
          </button>
        </div>

        <p className="muted" style={{ fontSize: "0.82rem", marginTop: "14px", marginBottom: 0 }}>
          Keys typed here are encrypted before they touch the database and are never shown again —
          only their last four characters. Clearing a key falls back to whatever was set at deploy
          time, if anything.
        </p>
      </section>
    </div>
  );
}

function badgeStyle(color: string, background: string): React.CSSProperties {
  return {
    fontSize: "0.74rem",
    fontWeight: 600,
    color,
    background,
    padding: "2px 10px",
    borderRadius: "999px",
    border: `1px solid ${color}33`,
    display: "inline-flex",
    alignItems: "center",
  };
}
