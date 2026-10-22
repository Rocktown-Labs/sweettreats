import { Link, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react";

import { useCart } from "../lib/cart";
import { createOrder, getPickupAvailability, getShippingOptions } from "../lib/api";
import { formatMoney } from "../lib/format";
import { authClient } from "../lib/auth-client";
import {
  PICKUP_WINDOW_DAYS,
  addDaysIso,
  formatPickupDate,
  hasBookableSlots,
  pickupSlots,
  shopDateIso,
} from "../lib/pickup";
import { DatePicker } from "../components/date-picker";
import { TimePicker } from "../components/time-picker";
import { LocationPicker } from "../components/location-picker";

export const Route = createFileRoute("/checkout")({
  loader: () => getPickupAvailability(),
  component: CheckoutPage,
});

const PHONE_PATTERN = /^\+?[0-9()\-\s]{7,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName =
  | "name"
  | "email"
  | "phone"
  | "pickupLocationId"
  | "pickupDate"
  | "pickupTime"
  | "shipName"
  | "shipLine1"
  | "shipCity"
  | "shipState"
  | "shipZip"
  | "shippingRate";

type FieldErrors = Partial<Record<FieldName, string>>;

type Step = 1 | 2 | 3;

const STEP_LABELS = ["Your info", "Delivery", "Confirm"] as const;

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <small id={id} className="field-error" role="alert">
      {message}
    </small>
  ) : null;
}

function CheckoutPage() {
  const pickup = Route.useLoaderData();
  const locations = pickup.locations ?? [];
  const cart = useCart();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const submitOrder = useServerFn(createOrder);
  const fetchShippingOptions = useServerFn(getShippingOptions);

  // ── Step state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  // ── Contact state (Step 1) ──────────────────────────────────────────
  const [customerName, setCustomerName] = useState(() => session?.user?.name || "");
  const [customerEmail, setCustomerEmail] = useState(() => session?.user?.email || "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  // ── Delivery state (Step 2) ─────────────────────────────────────────
  const [method, setMethod] = useState<"pickup" | "shipping">("pickup");
  const [pickupLocationId, setPickupLocationId] = useState(() => locations[0]?.id ?? "");
  const [pickupDate, setPickupDate] = useState(pickup.pickupDate);
  const [pickupTime, setPickupTime] = useState("");

  const [shipName, setShipName] = useState(() => session?.user?.name || "");
  const [shipLine1, setShipLine1] = useState("");
  const [shipLine2, setShipLine2] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("AR");
  const [shipZip, setShipZip] = useState("");

  // ── Shipping rates ───────────────────────────────────────────────────
  const [rateOptions, setRateOptions] = useState<
    { title: string; amountCents: number; estimatedDays: number | null }[]
  >([]);
  const [handlingFeeCents, setHandlingFeeCents] = useState(0);
  const [selectedRate, setSelectedRate] = useState("");
  const [isQuoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const lastQuotedKeyRef = useRef("");
  const quoteSeqRef = useRef(0);

  // ── Errors & submit ───────────────────────────────────────────────────
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setSubmitting] = useState(false);

  const selectedLocation = locations.find((l) => l.id === pickupLocationId);
  const cartHasUnshippable = cart.lines.some((line) => line.isShippable === false);
  const selectedRateOption = rateOptions.find((o) => o.title === selectedRate) ?? null;
  const shippingTotalCents =
    selectedRateOption != null ? selectedRateOption.amountCents + handlingFeeCents : 0;
  const totalCents =
    method === "shipping" && selectedRateOption
      ? cart.subtotalCents + shippingTotalCents
      : cart.subtotalCents;

  // ── Session prefill ───────────────────────────────────────────────────
  useEffect(() => {
    if (session?.user?.name) {
      setCustomerName((prev) => prev || session.user.name);
      setShipName((prev) => prev || session.user.name);
    }
    if (session?.user?.email) {
      setCustomerEmail((prev) => prev || session.user.email);
    }
  }, [session?.user?.name, session?.user?.email]);

  // ── Pickup slots ──────────────────────────────────────────────────────
  const todayIso = shopDateIso();
  const todayHasSlots = useMemo(() => hasBookableSlots(todayIso), [todayIso]);
  const minDate = todayHasSlots
    ? pickup.pickupDate
    : pickup.pickupDate < addDaysIso(todayIso, 1)
      ? addDaysIso(todayIso, 1)
      : pickup.pickupDate;
  const maxDate = addDaysIso(minDate, PICKUP_WINDOW_DAYS);

  useEffect(() => {
    if (pickupDate < minDate) setPickupDate(minDate);
  }, [minDate, pickupDate]);

  const slots = useMemo(() => pickupSlots(pickupDate), [pickupDate]);
  const noSlotsLeft = slots.every((s) => s.disabled);

  const clearFieldError = (field: FieldName) =>
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const changeDate = (next: string) => {
    setPickupDate(next);
    clearFieldError("pickupDate");
    const stillValid = pickupSlots(next).some(
      (slot) => slot.value === pickupTime && !slot.disabled,
    );
    if (!stillValid) setPickupTime("");
  };

  const resetRates = () => {
    setRateOptions([]);
    setSelectedRate("");
  };

  // ── Shipping rate auto-fetch ─────────────────────────────────────────
  const isAddressComplete =
    shipName.trim().length >= 2 &&
    shipLine1.trim().length >= 3 &&
    shipCity.trim().length >= 2 &&
    shipState.trim().length === 2 &&
    /^\d{5}(-\d{4})?$/.test(shipZip.trim());

  const currentQuoteKey = `${shipName.trim()}|${shipLine1.trim()}|${shipLine2.trim()}|${shipCity.trim()}|${shipState.trim()}|${shipZip.trim()}|${cart.lines.map((l) => `${l.id}:${l.quantity}`).join(",")}`;

  const loadRates = async () => {
    if (!isAddressComplete || cart.lines.length === 0) return;
    if (currentQuoteKey === lastQuotedKeyRef.current && rateOptions.length > 0) return;

    // Drop out-of-order responses: if the address changed while a quote was
    // in flight, a slow stale reply must not overwrite the fresh one.
    const seq = ++quoteSeqRef.current;

    setQuoting(true);
    setQuoteError("");
    try {
      const result = await fetchShippingOptions({
        data: {
          items: cart.lines.map((l) => ({ id: l.id, quantity: l.quantity })),
          address: {
            name: shipName.trim(),
            line1: shipLine1.trim(),
            line2: shipLine2.trim(),
            city: shipCity.trim(),
            state: shipState.trim().toUpperCase(),
            zip: shipZip.trim(),
          },
        },
      });
      // Stale reply (address changed mid-flight) — a newer quote owns the UI.
      if (seq !== quoteSeqRef.current) return;
      if (!result.configured) {
        setQuoteError("Shipping isn't available right now. Choose pickup instead.");
        return;
      }
      setHandlingFeeCents(result.handlingFeeCents);
      setRateOptions(result.options);
      lastQuotedKeyRef.current = currentQuoteKey;
      if (!selectedRate || !result.options.some((o) => o.title === selectedRate)) {
        setSelectedRate(result.options[0]?.title ?? "");
      }
      if (result.options.length === 0) {
        setQuoteError("No shipping services available for that address.");
      }
    } catch (caught) {
      if (seq !== quoteSeqRef.current) return;
      setQuoteError(caught instanceof Error ? caught.message : "Could not fetch rates.");
    } finally {
      if (seq === quoteSeqRef.current) {
        setQuoting(false);
      }
    }
  };

  // Debounced auto-fetch when address becomes complete
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (method !== "shipping" || !isAddressComplete) return;
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    quoteTimerRef.current = setTimeout(() => void loadRates(), 400);
    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
  }, [method, isAddressComplete, currentQuoteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step validation ───────────────────────────────────────────────────
  const validateStep1 = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (customerName.trim().length < 2) errors.name = "Enter your name.";
    if (!EMAIL_PATTERN.test(customerEmail.trim())) errors.email = "Enter a valid email.";
    if (!PHONE_PATTERN.test(customerPhone.trim())) errors.phone = "Enter a phone number.";
    return errors;
  };

  const validateStep2 = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (method === "pickup") {
      if (!pickupLocationId) errors.pickupLocationId = "Choose a pickup spot.";
      if (!pickupDate) errors.pickupDate = "Choose a date.";
      if (!pickupTime) {
        errors.pickupTime = "Choose a time.";
      } else if (!slots.some((s) => s.value === pickupTime && !s.disabled)) {
        errors.pickupTime = "That time has passed.";
      }
    } else {
      if (shipName.trim().length < 2) errors.shipName = "Enter the recipient's name.";
      if (shipLine1.trim().length < 3) errors.shipLine1 = "Enter a street address.";
      if (shipCity.trim().length < 2) errors.shipCity = "Enter a city.";
      if (shipState.trim().length !== 2) errors.shipState = "Enter a 2-letter state.";
      if (!/^\d{5}(-\d{4})?$/.test(shipZip.trim())) errors.shipZip = "Enter a valid ZIP.";
      if (!selectedRate) errors.shippingRate = "Choose a shipping speed.";
    }
    return errors;
  };

  // ── Step transitions ──────────────────────────────────────────────────
  const goNext = () => {
    setError("");
    const errors = step === 1 ? validateStep1() : step === 2 ? validateStep2() : {};
    setFieldErrors(errors);
    const firstInvalid = Object.keys(errors).find((key) => errors[key as FieldName]);
    if (firstInvalid) {
      document.querySelector<HTMLElement>(`#checkout-${firstInvalid}`)?.focus();
      return;
    }
    if (step < 3) {
      setStep((step + 1) as Step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    setError("");
    if (step > 1) {
      setStep((step - 1) as Step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError("");

    const step1Errors = validateStep1();
    const step2Errors = validateStep2();
    const allErrors = { ...step1Errors, ...step2Errors };

    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(allErrors);
      setStep(Object.keys(step1Errors).length > 0 ? 1 : 2);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitOrder({
        data: {
          name: customerName.trim(),
          email: customerEmail.trim(),
          phone: customerPhone.trim(),
          notes: notes.trim(),
          items: cart.lines.map((l) => ({ id: l.id, quantity: l.quantity })),
          clientOrderId: cart.clientOrderId || undefined,
          ...(method === "pickup"
            ? { pickupLocationId, pickupDate, pickupTime }
            : {
                shipping: {
                  address: {
                    name: shipName.trim(),
                    line1: shipLine1.trim(),
                    line2: shipLine2.trim(),
                    city: shipCity.trim(),
                    state: shipState.trim().toUpperCase(),
                    zip: shipZip.trim(),
                  },
                  serviceTitle: selectedRate,
                },
              }),
        },
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        await navigate({
          to: "/order/success",
          search: { orderId: result.orderId, t: result.orderToken },
        });
      }
    } catch (caught) {
      setError(
        caught instanceof TypeError
          ? "Can't reach the server. Check your connection and try again."
          : caught instanceof Error && caught.message
            ? caught.message
            : "Could not place order.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Empty cart guard ──────────────────────────────────────────────────
  if (!cart.ready) {
    return (
      <main className="page">
        <div className="section-head">
          <div>
            <p className="eyebrow">Checkout</p>
            <h1 className="page-title">Loading…</h1>
          </div>
        </div>
      </main>
    );
  }

  if (!cart.lines.length && !isSubmitting) {
    return (
      <main className="page">
        <div className="section-head">
          <div>
            <p className="eyebrow">Checkout</p>
            <h1 className="page-title">Your cart is empty</h1>
          </div>
        </div>
        <section className="panel empty-state">
          <p>Add some fresh-baked cookies before checking out.</p>
          <Link to="/menu" className="primary-button" style={{ marginTop: "14px" }}>
            Browse the menu
          </Link>
        </section>
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <main className="page">
      {/* Header */}
      <div className="section-head">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1 className="page-title">
            {step === 1 ? "Your info" : step === 2 ? "Delivery" : "Confirm your order"}
          </h1>
        </div>
      </div>

      {/* Stepper */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
        aria-label="Checkout progress"
      >
        {STEP_LABELS.map((label, index) => {
          const stepNum = index + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {index > 0 && <ChevronRight size={14} style={{ color: "#c4a978" }} />}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "999px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  background: isActive ? "#241408" : isDone ? "#e3f5e1" : "#f5ede1",
                  color: isActive ? "#fff8e7" : isDone ? "#1d6f28" : "#8c6f4a",
                  border: `1.5px solid ${isActive ? "#241408" : isDone ? "#1d6f28" : "#ead8bf"}`,
                }}
              >
                <span
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.72rem",
                    background: isActive ? "#fff8e7" : isDone ? "#1d6f28" : "#ead8bf",
                    color: isActive ? "#241408" : "#fff",
                  }}
                >
                  {isDone ? <Check size={12} /> : stepNum}
                </span>
                {label}
              </span>
            </span>
          );
        })}
      </nav>

      <div className="layout-two">
        {/* ── Form panel (left) ── */}
        <section className="form-panel">
          {step === 1 && (
            <div>
              {/* Contact */}
              <fieldset className="form-section" style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 700, marginBottom: "16px", fontSize: "1rem" }}>
                  How can we reach you?
                </legend>
                <div className="field-grid">
                  <label className="field field-wide">
                    <span>Name *</span>
                    <input
                      id="checkout-name"
                      value={customerName}
                      autoComplete="name"
                      required
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        clearFieldError("name");
                      }}
                      aria-invalid={fieldErrors.name ? true : undefined}
                    />
                    <FieldError id="checkout-name-error" message={fieldErrors.name} />
                  </label>
                  <label className="field">
                    <span>Email *</span>
                    <input
                      id="checkout-email"
                      type="email"
                      value={customerEmail}
                      autoComplete="email"
                      autoCapitalize="none"
                      required
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        clearFieldError("email");
                      }}
                      aria-invalid={fieldErrors.email ? true : undefined}
                    />
                    <FieldError id="checkout-email-error" message={fieldErrors.email} />
                  </label>
                  <label className="field">
                    <span>Phone *</span>
                    <input
                      id="checkout-phone"
                      type="tel"
                      value={customerPhone}
                      autoComplete="tel"
                      required
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9()+\-\s]/g, "");
                        setCustomerPhone(digits);
                        clearFieldError("phone");
                      }}
                      aria-invalid={fieldErrors.phone ? true : undefined}
                    />
                    <FieldError id="checkout-phone-error" message={fieldErrors.phone} />
                  </label>
                </div>
              </fieldset>

              {/* Method toggle */}
              <fieldset
                className="form-section"
                style={{ border: "none", padding: 0, marginTop: "28px" }}
              >
                <legend style={{ fontWeight: 700, marginBottom: "12px", fontSize: "1rem" }}>
                  Pickup or shipping?
                </legend>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setMethod("pickup")}
                    aria-pressed={method === "pickup"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 20px",
                      borderRadius: "999px",
                      border: method === "pickup" ? "2px solid #241408" : "1.5px solid #ead8bf",
                      background: method === "pickup" ? "#241408" : "transparent",
                      color: method === "pickup" ? "#fff8e7" : "#241408",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    <MapPin size={16} aria-hidden="true" />
                    Pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("shipping")}
                    disabled={cartHasUnshippable}
                    aria-pressed={method === "shipping"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 20px",
                      borderRadius: "999px",
                      border: method === "shipping" ? "2px solid #241408" : "1.5px solid #ead8bf",
                      background: method === "shipping" ? "#241408" : "transparent",
                      color: method === "shipping" ? "#fff8e7" : "#241408",
                      fontWeight: 600,
                      cursor: cartHasUnshippable ? "not-allowed" : "pointer",
                      fontSize: "0.9rem",
                      opacity: cartHasUnshippable ? 0.5 : 1,
                    }}
                  >
                    <Truck size={16} aria-hidden="true" />
                    Ship to me
                  </button>
                </div>
                {cartHasUnshippable ? (
                  <small className="field-hint" style={{ marginTop: "8px", display: "block" }}>
                    Some items are pickup-only, so shipping isn&apos;t available.
                  </small>
                ) : null}
              </fieldset>

              <button
                type="button"
                className="primary-button"
                onClick={goNext}
                style={{
                  marginTop: "32px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                Continue
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          {step === 2 && method === "pickup" && (
            <div>
              {pickup.closed ? (
                <p className="form-notice" role="status" style={{ marginBottom: "16px" }}>
                  We don&apos;t have an open pickup day in the next few weeks. You can still send an
                  order and the shop will confirm a day with you.
                </p>
              ) : null}
              <fieldset className="form-section" style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 700, marginBottom: "16px", fontSize: "1rem" }}>
                  Choose your pickup
                </legend>

                <div className="field-grid">
                  <div className="field field-wide">
                    <label htmlFor="checkout-pickupLocationId" className="field-label is-required">
                      Pickup spot
                    </label>
                    <LocationPicker
                      id="checkout-pickupLocationId"
                      value={pickupLocationId}
                      onChange={(next) => {
                        setPickupLocationId(next);
                        clearFieldError("pickupLocationId");
                      }}
                      locations={locations}
                      invalid={Boolean(fieldErrors.pickupLocationId)}
                    />
                    <FieldError
                      id="checkout-pickupLocationId-error"
                      message={fieldErrors.pickupLocationId}
                    />
                    {selectedLocation ? (
                      <div className="location-callout" role="region" aria-label="Pickup details">
                        <div className="location-callout-header">
                          <MapPin size={15} aria-hidden="true" className="location-callout-icon" />
                          <span className="location-callout-name">{selectedLocation.name}</span>
                          {selectedLocation.phone ? (
                            <span className="location-callout-phone">
                              · {selectedLocation.phone}
                            </span>
                          ) : null}
                        </div>
                        <p className="location-callout-address">{selectedLocation.address}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="field">
                    <label htmlFor="checkout-pickupDate" className="field-label is-required">
                      Date
                    </label>
                    <DatePicker
                      id="checkout-pickupDate"
                      value={pickupDate}
                      onChange={changeDate}
                      min={minDate}
                      max={maxDate}
                      invalid={Boolean(fieldErrors.pickupDate)}
                    />
                    <FieldError id="checkout-pickupDate-error" message={fieldErrors.pickupDate} />
                  </div>

                  <div className="field">
                    <label htmlFor="checkout-pickupTime" className="field-label is-required">
                      Time
                    </label>
                    <TimePicker
                      id="checkout-pickupTime"
                      value={pickupTime}
                      onChange={(next) => {
                        setPickupTime(next);
                        clearFieldError("pickupTime");
                      }}
                      slots={slots}
                      invalid={Boolean(fieldErrors.pickupTime)}
                    />
                    <FieldError id="checkout-pickupTime-error" message={fieldErrors.pickupTime} />
                    {noSlotsLeft && !fieldErrors.pickupTime ? (
                      <small className="field-hint" style={{ display: "block", marginTop: "4px" }}>
                        No times left on this date — try the next day.
                      </small>
                    ) : null}
                  </div>
                </div>
              </fieldset>

              <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
                <button type="button" className="secondary-button" onClick={goBack}>
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={goNext}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  Continue
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && method === "shipping" && (
            <div>
              <fieldset className="form-section" style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 700, marginBottom: "16px", fontSize: "1rem" }}>
                  Ship to
                </legend>
                <div className="field-grid">
                  <label className="field field-wide">
                    <span>Recipient name *</span>
                    <input
                      id="checkout-shipName"
                      value={shipName}
                      autoComplete="shipping name"
                      onChange={(e) => {
                        setShipName(e.target.value);
                        resetRates();
                        clearFieldError("shipName");
                      }}
                      aria-invalid={fieldErrors.shipName ? true : undefined}
                    />
                    <FieldError id="checkout-shipName-error" message={fieldErrors.shipName} />
                  </label>
                  <label className="field field-wide">
                    <span>Street address *</span>
                    <input
                      id="checkout-shipLine1"
                      value={shipLine1}
                      autoComplete="shipping address-line1"
                      onChange={(e) => {
                        setShipLine1(e.target.value);
                        resetRates();
                        clearFieldError("shipLine1");
                      }}
                      aria-invalid={fieldErrors.shipLine1 ? true : undefined}
                    />
                    <FieldError id="checkout-shipLine1-error" message={fieldErrors.shipLine1} />
                  </label>
                  <label className="field field-wide">
                    <span className="optional-label">
                      Apt / suite <em>(optional)</em>
                    </span>
                    <input
                      value={shipLine2}
                      autoComplete="shipping address-line2"
                      onChange={(e) => {
                        setShipLine2(e.target.value);
                        resetRates();
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>City *</span>
                    <input
                      id="checkout-shipCity"
                      value={shipCity}
                      autoComplete="shipping address-level2"
                      onChange={(e) => {
                        setShipCity(e.target.value);
                        resetRates();
                        clearFieldError("shipCity");
                      }}
                      aria-invalid={fieldErrors.shipCity ? true : undefined}
                    />
                    <FieldError id="checkout-shipCity-error" message={fieldErrors.shipCity} />
                  </label>
                  <label className="field">
                    <span>State *</span>
                    <input
                      id="checkout-shipState"
                      value={shipState}
                      maxLength={2}
                      autoComplete="shipping address-level1"
                      onChange={(e) => {
                        setShipState(e.target.value.toUpperCase());
                        resetRates();
                        clearFieldError("shipState");
                      }}
                      aria-invalid={fieldErrors.shipState ? true : undefined}
                    />
                    <FieldError id="checkout-shipState-error" message={fieldErrors.shipState} />
                  </label>
                  <label className="field">
                    <span>ZIP *</span>
                    <input
                      id="checkout-shipZip"
                      value={shipZip}
                      inputMode="numeric"
                      maxLength={10}
                      autoComplete="shipping postal-code"
                      onChange={(e) => {
                        setShipZip(e.target.value);
                        resetRates();
                        clearFieldError("shipZip");
                      }}
                      aria-invalid={fieldErrors.shipZip ? true : undefined}
                    />
                    <FieldError id="checkout-shipZip-error" message={fieldErrors.shipZip} />
                  </label>
                </div>
              </fieldset>

              {/* Shipping rates — auto-fetch, inline */}
              <div style={{ marginTop: "20px" }}>
                {isQuoting ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "16px",
                      background: "#fff9eb",
                      borderRadius: "10px",
                      border: "1.5px solid #ead8bf",
                    }}
                  >
                    <RefreshCw size={16} aria-hidden="true" className="animate-spin" />
                    <span style={{ fontSize: "0.88rem", color: "#6e5c47" }}>
                      Finding the best rates…
                    </span>
                  </div>
                ) : quoteError ? (
                  <p className="field-error" role="alert" style={{ padding: "0 4px" }}>
                    {quoteError}
                  </p>
                ) : rateOptions.length > 0 ? (
                  <div style={{ display: "grid", gap: "8px" }}>
                    <p
                      style={{
                        fontWeight: 700,
                        fontSize: "0.88rem",
                        margin: "0 0 4px",
                        color: "#241408",
                      }}
                    >
                      Shipping speed
                    </p>
                    {rateOptions.map((option) => (
                      <label
                        key={option.title}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 14px",
                          border:
                            selectedRate === option.title
                              ? "2px solid #241408"
                              : "1px solid #ead8bf",
                          borderRadius: "10px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name="shippingRate"
                          value={option.title}
                          checked={selectedRate === option.title}
                          onChange={() => {
                            setSelectedRate(option.title);
                            clearFieldError("shippingRate");
                          }}
                        />
                        <span style={{ flex: 1, fontSize: "0.88rem" }}>{option.title}</span>
                        {option.estimatedDays != null ? (
                          <small style={{ color: "#8c6f4a", fontSize: "0.78rem" }}>
                            {option.estimatedDays === 1 ? "1 day" : `${option.estimatedDays} days`}
                          </small>
                        ) : null}
                        <strong style={{ fontSize: "0.9rem" }}>
                          {formatMoney(option.amountCents)}
                        </strong>
                      </label>
                    ))}
                    {handlingFeeCents > 0 ? (
                      <small className="field-hint">
                        Plus {formatMoney(handlingFeeCents)} handling fee.
                      </small>
                    ) : null}
                    <FieldError
                      id="checkout-shippingRate-error"
                      message={fieldErrors.shippingRate}
                    />
                  </div>
                ) : (
                  <p className="field-hint" style={{ fontSize: "0.84rem" }}>
                    <Package
                      size={13}
                      aria-hidden="true"
                      style={{ marginRight: "4px", verticalAlign: "-2px" }}
                    />
                    USPS Priority shipping — rates appear when the address is complete.
                  </p>
                )}
                <FieldError id="checkout-shippingRate-error" message={fieldErrors.shippingRate} />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
                <button type="button" className="secondary-button" onClick={goBack}>
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={goNext}
                  disabled={method === "shipping" && !selectedRate}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  Continue
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              {/* Order summary */}
              <fieldset className="form-section" style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 700, marginBottom: "16px", fontSize: "1rem" }}>
                  Your order
                </legend>
                {cart.lines.map((line) => (
                  <div
                    key={line.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid #f1e2cc",
                    }}
                  >
                    <span style={{ fontSize: "0.9rem" }}>
                      {line.quantity} × {line.name}
                    </span>
                    <strong style={{ fontSize: "0.9rem" }}>
                      {formatMoney(line.priceCents * line.quantity)}
                    </strong>
                  </div>
                ))}
              </fieldset>

              {/* Delivery summary */}
              <fieldset
                className="form-section"
                style={{ border: "none", padding: 0, marginTop: "24px" }}
              >
                <legend style={{ fontWeight: 700, marginBottom: "12px", fontSize: "1rem" }}>
                  {method === "pickup" ? "Pickup" : "Shipping"}
                </legend>
                {method === "pickup" ? (
                  <div style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{selectedLocation?.name ?? ""}</p>
                    <p className="muted" style={{ margin: "2px 0", fontSize: "0.84rem" }}>
                      {selectedLocation?.address}
                    </p>
                    <p style={{ margin: "4px 0 0" }}>
                      <Clock
                        size={13}
                        aria-hidden="true"
                        style={{ verticalAlign: "-2px", marginRight: "4px" }}
                      />
                      {formatPickupDate(pickupDate)} at{" "}
                      {slots.find((slot) => slot.value === pickupTime)?.label ?? pickupTime}
                    </p>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{shipName}</p>
                    <p className="muted" style={{ margin: "2px 0", fontSize: "0.84rem" }}>
                      {shipLine1}
                      {shipLine2 ? `, ${shipLine2}` : ""}
                    </p>
                    <p className="muted" style={{ margin: 0, fontSize: "0.84rem" }}>
                      {shipCity}, {shipState} {shipZip}
                    </p>
                    <p style={{ margin: "4px 0 0" }}>
                      <Truck
                        size={13}
                        aria-hidden="true"
                        style={{ verticalAlign: "-2px", marginRight: "4px" }}
                      />
                      {selectedRateOption?.title} — {formatMoney(shippingTotalCents)}
                    </p>
                  </div>
                )}
              </fieldset>

              {/* Notes */}
              <fieldset
                className="form-section"
                style={{ border: "none", padding: 0, marginTop: "24px" }}
              >
                <label className="field field-wide">
                  <span className="optional-label">
                    Notes <em>(optional)</em>
                  </span>
                  <textarea
                    value={notes}
                    rows={3}
                    maxLength={500}
                    placeholder="Allergies, a gift message, anything we should know"
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </fieldset>

              {error ? (
                <p className="form-error" role="alert" style={{ marginTop: "16px" }}>
                  {error}
                </p>
              ) : null}

              <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
                <button type="button" className="secondary-button" onClick={goBack}>
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontSize: "1rem",
                    padding: "14px 28px",
                  }}
                >
                  {isSubmitting ? "Placing order…" : `Place order — ${formatMoney(totalCents)}`}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Cart sidebar (right) ── */}
        <aside className="panel" style={{ position: "sticky", top: "24px", alignSelf: "start" }}>
          <p className="eyebrow">Cart</p>
          {cart.lines.map((line) => (
            <div
              key={line.id}
              style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}
            >
              <span style={{ fontSize: "0.86rem", flex: 1 }}>{line.name}</span>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                ×{line.quantity}
              </span>
              <strong style={{ fontSize: "0.86rem" }}>
                {formatMoney(line.priceCents * line.quantity)}
              </strong>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #f1e2cc", paddingTop: "12px", marginTop: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem" }}>
              <span className="muted">Subtotal</span>
              <strong>{formatMoney(cart.subtotalCents)}</strong>
            </div>
            {method === "shipping" && selectedRateOption ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.86rem",
                  marginTop: "4px",
                }}
              >
                <span className="muted">Shipping{handlingFeeCents > 0 ? " + handling" : ""}</span>
                <strong>{formatMoney(shippingTotalCents)}</strong>
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px solid #ead8bf",
              }}
            >
              <span style={{ fontWeight: 700 }}>Total</span>
              <strong style={{ fontWeight: 800, fontSize: "1.15rem" }}>
                {formatMoney(totalCents)}
              </strong>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
