import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { RefreshCw, Save, Truck } from "lucide-react";
import { toast } from "sonner";

import {
  adminEnsureShippingSetup,
  getAdminDashboard,
  getAdminShippingRatePreview,
  getAdminShippingSettings,
  saveAdminShippingSettings,
} from "../lib/api";
import { formatMoney } from "../lib/format";

type DashboardItem = {
  id: string;
  name: string;
  packSize: number | null;
  weightOunces: number;
};

export const Route = createFileRoute("/admin/shipping")({
  loader: () => getAdminShippingSettings(),
  component: AdminShippingPage,
});

type FromAddress = {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
};

type Settings = {
  fromAddress: FromAddress | null;
  handlingFeeCents: number;
  box: { lengthIn: number; widthIn: number; heightIn: number };
  compareZips: string[];
};

const emptyAddress: FromAddress = {
  name: "",
  street1: "",
  street2: "",
  city: "Little Rock",
  state: "AR",
  zip: "",
  country: "US",
};

function AdminShippingPage() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  const saveSettings = useServerFn(saveAdminShippingSettings);
  const ensureSetup = useServerFn(adminEnsureShippingSetup);
  const previewRates = useServerFn(getAdminShippingRatePreview);
  const fetchDashboard = useServerFn(getAdminDashboard);
  const [items, setItems] = useState<DashboardItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchDashboard()
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fetchDashboard]);

  const [settings, setSettings] = useState<Settings>({
    ...initial.settings,
    fromAddress: initial.settings.fromAddress
      ? { ...emptyAddress, ...initial.settings.fromAddress }
      : null,
  });
  const [isSaving, setSaving] = useState(false);
  const [isSettingUp, setSettingUp] = useState(false);

  // Rate compare state
  const [zip, setZip] = useState(initial.settings.compareZips[0] ?? "");
  const [city, setCity] = useState("Little Rock");
  const [stateCode, setStateCode] = useState("AR");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [manualWeight, setManualWeight] = useState("");
  const [rates, setRates] = useState<
    { title: string; amountCents: number; estimatedDays: number | null }[]
  >([]);
  const [quotedWeight, setQuotedWeight] = useState<number | null>(null);
  const [quotedAt, setQuotedAt] = useState<string>("");
  const [isQuoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const selectedLines = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ id, quantity }));

  const runQuote = async () => {
    setQuoteError("");
    if (!/^\d{5}$/.test(zip)) {
      setQuoteError("Enter a 5-digit destination ZIP.");
      return;
    }
    const manualOunces = Number(manualWeight);
    if (selectedLines.length === 0 && !(manualOunces > 0)) {
      setQuoteError("Pick some items or enter a manual weight.");
      return;
    }
    setQuoting(true);
    try {
      const result = await previewRates({
        data: {
          ...(selectedLines.length > 0 ? { items: selectedLines } : {}),
          ...(manualOunces > 0 ? { manualWeightOunces: manualOunces } : {}),
          address: {
            name: "Rate preview",
            line1: "1 Rate Preview St",
            line2: "",
            city,
            state: stateCode.toUpperCase(),
            zip,
          },
        },
      });
      if (!result.configured) {
        setQuoteError("Shippo isn't configured (missing SHIPPO_API_KEY).");
        return;
      }
      setRates([...result.options].sort((a, b) => a.amountCents - b.amountCents));
      setQuotedWeight(result.totalOunces);
      setQuotedAt(new Date().toLocaleTimeString());
      if (result.options.length === 0) {
        setQuoteError(
          "Shippo returned no options. Make sure a Service Group exists (button below) and your account has USPS available.",
        );
      }
    } catch (caught) {
      setQuoteError(caught instanceof Error ? caught.message : "Could not fetch rates.");
    } finally {
      setQuoting(false);
    }
  };

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const timer = setInterval(runQuote, 5 * 60 * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, zip, city, stateCode, manualWeight, quantities]);

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings({
        data: {
          fromAddress:
            settings.fromAddress && settings.fromAddress.name && settings.fromAddress.street1
              ? {
                  name: settings.fromAddress.name,
                  street1: settings.fromAddress.street1,
                  street2: settings.fromAddress.street2,
                  city: settings.fromAddress.city,
                  state: settings.fromAddress.state.toUpperCase().slice(0, 2),
                  zip: settings.fromAddress.zip,
                  country: "US",
                }
              : null,
          handlingFeeCents: settings.handlingFeeCents,
          box: settings.box,
          compareZips: settings.compareZips,
        },
      });
      toast.success("Shipping settings saved");
      await router.invalidate();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const runEnsureSetup = async () => {
    setSettingUp(true);
    try {
      const result = await ensureSetup();
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Setup failed");
    } finally {
      setSettingUp(false);
    }
  };

  const address = settings.fromAddress ?? emptyAddress;

  return (
    <div className="admin-main">
      <div className="section-head admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Shipping</h1>
          <p className="muted" style={{ marginTop: "4px" }}>
            USPS rates via Shippo, pack weights, and the handling fee customers pay at checkout.
          </p>
        </div>
      </div>

      {!initial.shippoConfigured ? (
        <div className="panel" style={{ marginBottom: "18px", borderColor: "#d8a24a" }}>
          <strong>Shippo isn&apos;t connected yet.</strong>{" "}
          <span className="muted">
            Add the <code>SHIPPO_API_KEY</code> secret to enable quotes. Everything below can be
            configured now and lights up when the key exists.
          </span>
        </div>
      ) : null}

      {/* Settings */}
      <section className="panel" style={{ marginBottom: "18px" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", margin: "0 0 14px" }}>
          Ship-from address &amp; fees
        </h2>
        <div className="field-grid">
          <label className="field">
            <span className="field-label">Shop name</span>
            <input
              value={address.name}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  fromAddress: { ...address, name: event.target.value },
                })
              }
              placeholder="Sweet Treats LR"
            />
          </label>
          <label className="field">
            <span className="field-label">Street address</span>
            <input
              value={address.street1}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  fromAddress: { ...address, street1: event.target.value },
                })
              }
              placeholder="123 Main St"
            />
          </label>
          <label className="field">
            <span className="field-label">Apt / suite</span>
            <input
              value={address.street2}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  fromAddress: { ...address, street2: event.target.value },
                })
              }
            />
          </label>
          <label className="field">
            <span className="field-label">City</span>
            <input
              value={address.city}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  fromAddress: { ...address, city: event.target.value },
                })
              }
            />
          </label>
          <label className="field">
            <span className="field-label">State</span>
            <input
              value={address.state}
              maxLength={2}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  fromAddress: { ...address, state: event.target.value.toUpperCase() },
                })
              }
            />
          </label>
          <label className="field">
            <span className="field-label">ZIP</span>
            <input
              value={address.zip}
              inputMode="numeric"
              maxLength={10}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  fromAddress: { ...address, zip: event.target.value },
                })
              }
            />
          </label>
          <label className="field">
            <span className="field-label">Handling fee ($)</span>
            <input
              type="number"
              min="0"
              step="0.25"
              value={(settings.handlingFeeCents / 100).toFixed(2)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  handlingFeeCents: Math.max(0, Math.round(Number(event.target.value || 0) * 100)),
                })
              }
            />
            <small className="field-hint">Added on top of the USPS rate at checkout.</small>
          </label>
          <label className="field">
            <span className="field-label">Box length (in)</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={settings.box.lengthIn}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  box: { ...settings.box, lengthIn: Number(event.target.value) || 0 },
                })
              }
            />
          </label>
          <label className="field">
            <span className="field-label">Box width (in)</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={settings.box.widthIn}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  box: { ...settings.box, widthIn: Number(event.target.value) || 0 },
                })
              }
            />
          </label>
          <label className="field">
            <span className="field-label">Box height (in)</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={settings.box.heightIn}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  box: { ...settings.box, heightIn: Number(event.target.value) || 0 },
                })
              }
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
          <button type="button" className="primary-button" onClick={save} disabled={isSaving}>
            <Save size={16} aria-hidden="true" style={{ marginRight: "6px" }} />
            {isSaving ? "Saving..." : "Save settings"}
          </button>
          <button
            type="button"
            className="primary-button"
            style={{ background: "#6b5847" }}
            onClick={runEnsureSetup}
            disabled={isSettingUp}
            title="Creates the USPS service group Shippo needs before /live-rates returns options"
          >
            <Truck size={16} aria-hidden="true" style={{ marginRight: "6px" }} />
            {isSettingUp ? "Checking..." : "Set up USPS service group"}
          </button>
        </div>
      </section>

      {/* Rate compare */}
      <section className="panel">
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", margin: "0 0 14px" }}>
          Compare current USPS rates
        </h2>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.86rem" }}>
          Pick items (weights come from each item&apos;s settings, packs expand into their cookies)
          or enter a manual weight, then quote against a destination ZIP.
        </p>
        <div className="field-grid">
          <label className="field">
            <span className="field-label">Destination ZIP</span>
            <input
              value={zip}
              inputMode="numeric"
              maxLength={5}
              onChange={(event) => setZip(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">City</span>
            <input value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">State</span>
            <input
              value={stateCode}
              maxLength={2}
              onChange={(event) => setStateCode(event.target.value.toUpperCase())}
            />
          </label>
          <label className="field">
            <span className="field-label">Or manual weight (oz)</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 48"
              value={manualWeight}
              onChange={(event) => setManualWeight(event.target.value)}
            />
            <small className="field-hint">Overrides item weights entirely.</small>
          </label>
        </div>

        <fieldset className="form-section" style={{ marginTop: "16px" }}>
          <legend>Items</legend>
          <div style={{ display: "grid", gap: "6px" }}>
            {items.map((item) => {
              const quantity = quantities[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px",
                    border: "1px solid #ead8bf",
                    borderRadius: "10px",
                  }}
                >
                  <span style={{ flex: 1 }}>
                    {item.name}
                    {item.packSize ? (
                      <small style={{ color: "#8c6f4a" }}> · pack of {item.packSize}</small>
                    ) : null}
                    {"weightOunces" in item && (item as { weightOunces?: number }).weightOunces ? (
                      <small style={{ color: "#8c6f4a" }}>
                        {" "}
                        · {(item as { weightOunces: number }).weightOunces} oz
                      </small>
                    ) : (
                      <small style={{ color: "#c0392b" }}> · no weight set</small>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantities({
                        ...quantities,
                        [item.id]: Math.max(0, quantity - 1),
                      })
                    }
                  >
                    −
                  </button>
                  <strong style={{ minWidth: "18px", textAlign: "center" }}>{quantity}</strong>
                  <button
                    type="button"
                    onClick={() => setQuantities({ ...quantities, [item.id]: quantity + 1 })}
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            marginTop: "14px",
            flexWrap: "wrap",
          }}
        >
          <button type="button" className="primary-button" onClick={runQuote} disabled={isQuoting}>
            <RefreshCw size={16} aria-hidden="true" style={{ marginRight: "6px" }} />
            {isQuoting ? "Getting rates..." : "Get live rates"}
          </button>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.86rem",
            }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            Auto-refresh every 5 min
          </label>
          {quotedAt ? <small className="muted">Last quoted at {quotedAt}</small> : null}
        </div>

        {quoteError ? (
          <p className="field-error" role="alert" style={{ marginTop: "12px" }}>
            {quoteError}
          </p>
        ) : null}

        {rates.length > 0 ? (
          <table
            className="admin-table"
            style={{ width: "100%", marginTop: "16px", borderCollapse: "collapse" }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ead8bf" }}>
                <th style={{ padding: "8px" }}>Service</th>
                <th style={{ padding: "8px" }}>Est. transit</th>
                <th style={{ padding: "8px" }}>USPS rate</th>
                <th style={{ padding: "8px" }}>+ handling</th>
                <th style={{ padding: "8px" }}>Customer pays</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.title} style={{ borderBottom: "1px solid #f1e2cc" }}>
                  <td style={{ padding: "8px" }}>{rate.title}</td>
                  <td style={{ padding: "8px" }}>
                    {rate.estimatedDays == null ? "—" : `${rate.estimatedDays} day(s)`}
                  </td>
                  <td style={{ padding: "8px" }}>{formatMoney(rate.amountCents)}</td>
                  <td style={{ padding: "8px" }}>{formatMoney(settings.handlingFeeCents)}</td>
                  <td style={{ padding: "8px" }}>
                    <strong>{formatMoney(rate.amountCents + settings.handlingFeeCents)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {quotedWeight != null ? (
          <p className="muted" style={{ fontSize: "0.84rem", marginTop: "10px" }}>
            Quoted parcel weight: {quotedWeight} oz ({(quotedWeight / 16).toFixed(2)} lb).
          </p>
        ) : null}
      </section>
    </div>
  );
}
