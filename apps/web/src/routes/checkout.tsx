import { Link, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Edit2,
  Lock,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";

import { useCart } from "../lib/cart";
import { createOrder, getPickupAvailability, getShippingOptions } from "../lib/api";
import { formatMoney } from "../lib/format";
import { authClient } from "../lib/auth-client";
import {
  PICKUP_WINDOW_DAYS,
  addDaysIso,
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

  // Stepped checkout flow: 'details' -> 'shipping'
  const [step, setStep] = useState<"details" | "shipping">("details");

  // Contact state
  const [customerName, setCustomerName] = useState(() => session?.user?.name || "");
  const [customerEmail, setCustomerEmail] = useState(() => session?.user?.email || "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Pickup state
  const [method, setMethod] = useState<"pickup" | "shipping">("pickup");
  const [pickupLocationId, setPickupLocationId] = useState(() => locations[0]?.id ?? "");
  const [pickupDate, setPickupDate] = useState(pickup.pickupDate);
  const [pickupTime, setPickupTime] = useState("");

  // Shipping address state
  const [shipName, setShipName] = useState(() => session?.user?.name || "");
  const [shipLine1, setShipLine1] = useState("");
  const [shipLine2, setShipLine2] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("AR");
  const [shipZip, setShipZip] = useState("");

  // Quoted shipping rates
  const [rateOptions, setRateOptions] = useState<
    { title: string; amountCents: number; estimatedDays: number | null }[]
  >([]);
  const [handlingFeeCents, setHandlingFeeCents] = useState(0);
  const [selectedRate, setSelectedRate] = useState("");
  const [isQuoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const lastQuotedKeyRef = useRef("");

  // Form errors & submit state
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setSubmitting] = useState(false);

  const selectedLocation = locations.find((l) => l.id === pickupLocationId);
  const cartHasUnshippable = cart.lines.some((line) => line.isShippable === false);
  const selectedRateOption = rateOptions.find((option) => option.title === selectedRate) ?? null;
  const shippingTotalCents =
    selectedRateOption != null ? selectedRateOption.amountCents + handlingFeeCents : 0;

  // Sync user info from session if loaded after mount
  useEffect(() => {
    if (session?.user?.name) {
      setCustomerName((prev) => prev || session.user.name);
      setShipName((prev) => prev || session.user.name);
    }
    if (session?.user?.email) {
      setCustomerEmail((prev) => prev || session.user.email);
    }
  }, [session?.user?.name, session?.user?.email]);

  // Slots calculation for pickup
  const todayIso = shopDateIso();
  const todayHasSlots = useMemo(() => hasBookableSlots(todayIso), [todayIso]);
  const minDate = todayHasSlots
    ? pickup.pickupDate
    : pickup.pickupDate < addDaysIso(todayIso, 1)
      ? addDaysIso(todayIso, 1)
      : pickup.pickupDate;
  const maxDate = addDaysIso(minDate, PICKUP_WINDOW_DAYS);

  // If pickupDate was initialized to a date before minDate (e.g. today after cutoff), advance it
  useEffect(() => {
    if (pickupDate < minDate) {
      setPickupDate(minDate);
    }
  }, [minDate, pickupDate]);

  const slots = useMemo(() => pickupSlots(pickupDate), [pickupDate]);
  const noSlotsLeft = slots.every((slot) => slot.disabled);

  const clearFieldError = (field: FieldName) =>
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const changeDate = (next: string) => {
    setPickupDate(next);
    clearFieldError("pickupDate");
    const stillValid = pickupSlots(next).some(
      (slot) => slot.value === pickupTime && !slot.disabled,
    );
    if (!stillValid) {
      setPickupTime("");
    }
  };

  // Check if address is sufficiently complete for quoting
  const isAddressComplete =
    shipName.trim().length >= 2 &&
    shipLine1.trim().length >= 3 &&
    shipCity.trim().length >= 2 &&
    shipState.trim().length === 2 &&
    /^\d{5}(-\d{4})?$/.test(shipZip.trim());

  const currentQuoteKey = `${shipName.trim()}|${shipLine1.trim()}|${shipLine2.trim()}|${shipCity.trim()}|${shipState.trim().toUpperCase()}|${shipZip.trim()}|${cart.lines.map((l) => `${l.id}:${l.quantity}`).join(",")}`;

  // Core quote fetcher
  const loadRates = async (silent = false) => {
    if (!isAddressComplete || cart.lines.length === 0) return;
    if (currentQuoteKey === lastQuotedKeyRef.current && rateOptions.length > 0) return;

    if (!silent) setQuoteError("");
    setQuoting(true);

    try {
      const result = await fetchShippingOptions({
        data: {
          items: cart.lines.map((line) => ({ id: line.id, quantity: line.quantity })),
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

      if (!result.configured) {
        setQuoteError("Shipping isn't available right now. Choose bakery pickup instead.");
        return;
      }

      setHandlingFeeCents(result.handlingFeeCents);
      setRateOptions(result.options);
      lastQuotedKeyRef.current = currentQuoteKey;

      // Select first (cheapest) rate by default if none or stale
      if (
        !selectedRate ||
        !result.options.some((opt: { title: string }) => opt.title === selectedRate)
      ) {
        setSelectedRate(result.options[0]?.title ?? "");
      }

      if (result.options.length === 0) {
        setQuoteError("No shipping services are available for that destination address.");
      } else {
        setQuoteError("");
      }
    } catch (caught) {
      if (!silent || step === "shipping") {
        setQuoteError(caught instanceof Error ? caught.message : "Could not fetch shipping rates.");
      }
    } finally {
      setQuoting(false);
    }
  };

  // Debounced background quote prefetching: when user completes the address in Step 1,
  // fetch rates silently in background so Step 2 loads immediately without freezing!
  useEffect(() => {
    if (method !== "shipping" || !isAddressComplete || cart.lines.length === 0) {
      return;
    }

    if (currentQuoteKey === lastQuotedKeyRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      void loadRates(true);
    }, 550);

    return () => clearTimeout(timer);
  }, [
    method,
    isAddressComplete,
    currentQuoteKey,
    shipName,
    shipLine1,
    shipLine2,
    shipCity,
    shipState,
    shipZip,
  ]);

  // Validation for Step 1
  const validateStep1 = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (customerName.trim().length < 2) {
      errors.name = "Enter your name so we know who to address the order to.";
    }
    if (!EMAIL_PATTERN.test(customerEmail.trim())) {
      errors.email = "Enter a valid email address for your order confirmation.";
    }
    if (!PHONE_PATTERN.test(customerPhone.trim())) {
      errors.phone = "Enter a phone number we can reach you at.";
    }

    if (method === "pickup") {
      if (!pickupLocationId) errors.pickupLocationId = "Choose a pickup location.";
      if (!pickupDate) errors.pickupDate = "Choose a pickup date.";
      if (!pickupTime) {
        errors.pickupTime = "Choose a pickup time.";
      } else if (!slots.some((slot) => slot.value === pickupTime && !slot.disabled)) {
        errors.pickupTime = "That time has passed. Pick a later slot.";
      }
    } else {
      if (shipName.trim().length < 2) errors.shipName = "Enter the recipient's name.";
      if (shipLine1.trim().length < 3) errors.shipLine1 = "Enter a valid street address.";
      if (shipCity.trim().length < 2) errors.shipCity = "Enter a city.";
      if (shipState.trim().length !== 2)
        errors.shipState = "Enter a 2-letter state code (e.g. AR).";
      if (!/^\d{5}(-\d{4})?$/.test(shipZip.trim()))
        errors.shipZip = "Enter a valid 5-digit ZIP code.";
    }

    return errors;
  };

  // Transition from Step 1 to Step 2
  const handleProceedToStep2 = () => {
    setError("");
    const errors = validateStep1();
    setFieldErrors(errors);

    const firstInvalid = (Object.keys(errors) as FieldName[]).find((key) => errors[key]);
    if (firstInvalid) {
      document.querySelector<HTMLElement>(`#checkout-${firstInvalid}`)?.focus();
      return;
    }

    setStep("shipping");
    window.scrollTo({ top: 0, behavior: "smooth" });

    // If shipping and rates aren't fetched yet, trigger immediately
    if (method === "shipping" && rateOptions.length === 0 && !isQuoting) {
      void loadRates(false);
    }
  };

  // Final order submission
  const handleFinalSubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (isSubmitting) return;

    setError("");
    const errors = validateStep1();

    if (method === "shipping" && !selectedRate) {
      errors.shippingRate = "Please select a shipping speed.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStep("details");
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
          items: cart.lines.map((line) => ({ id: line.id, quantity: line.quantity })),
          clientOrderId: cart.clientOrderId || undefined,
          ...(method === "pickup"
            ? {
                pickupLocationId,
                pickupDate,
                pickupTime,
              }
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

      cart.clear();
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

  if (!cart.ready) {
    return <CheckoutPending />;
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
          <p>Add some fresh-baked cookies to your cart before checking out.</p>
          <Link to="/menu" className="primary-button" style={{ marginTop: "14px" }}>
            Browse the menu
          </Link>
        </section>
      </main>
    );
  }

  // Find lowest rate and fastest rate for badges
  const lowestRateAmount =
    rateOptions.length > 0 ? Math.min(...rateOptions.map((o) => o.amountCents)) : null;
  const fastestDays =
    rateOptions.length > 0
      ? Math.min(...rateOptions.filter((o) => o.estimatedDays != null).map((o) => o.estimatedDays!))
      : null;

  return (
    <main className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            {step === "details" ? "Step 1 of 2 · Information" : "Step 2 of 2 · Review & Shipping"}
          </p>
          <h1 className="page-title">
            {step === "details" ? "Send order" : "Review & Choose Shipping"}
          </h1>
          <p className="muted">
            {session?.user ? (
              <span>
                Ordering as <strong>{session.user.name}</strong> ({session.user.email})
              </span>
            ) : (
              <span>
                Continue as a guest, or{" "}
                <Link to="/sign-in" search={{ redirect: "/checkout" }}>
                  log in
                </Link>{" "}
                before ordering to keep order history.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Checkout Progress Stepper */}
      <nav className="checkout-stepper" aria-label="Checkout Progress">
        <button
          type="button"
          onClick={() => setStep("details")}
          className={`step-pill ${step === "details" ? "active" : "completed"}`}
        >
          <span className="step-num">{step === "shipping" ? <Check size={14} /> : "1"}</span>
          <span>1. Details & Address</span>
        </button>
        <ChevronRight size={16} className="step-arrow" />
        <button
          type="button"
          onClick={() => {
            if (step === "details") handleProceedToStep2();
          }}
          className={`step-pill ${step === "shipping" ? "active" : ""}`}
        >
          <span className="step-num">2</span>
          <span>2. {method === "shipping" ? "Shipping & Review" : "Review & Confirm"}</span>
        </button>
        <ChevronRight size={16} className="step-arrow" />
        <div className="step-pill" style={{ opacity: 0.65 }}>
          <span className="step-num">3</span>
          <span>3. Payment</span>
        </div>
      </nav>

      <div className="layout-two">
        <section className="form-panel">
          {step === "details" ? (
            /* ========================================================== */
            /* STEP 1: CONTACT DETAILS & FULFILLMENT METHOD CHOICE        */
            /* ========================================================== */
            <div>
              {pickup.closed ? (
                <p className="form-notice" role="status" style={{ marginBottom: "16px" }}>
                  We don&apos;t have an open pickup day in the next few weeks. You can still send an
                  order and the shop will confirm a day with you.
                </p>
              ) : null}

              <p className="required-note" style={{ marginBottom: "16px" }}>
                <span aria-hidden="true">*</span> Required fields
              </p>

              {/* Contact Information */}
              <fieldset
                className="form-section"
                style={{ border: "none", padding: 0, margin: "0 0 24px" }}
              >
                <legend style={{ fontWeight: 800, fontSize: "1.05rem", marginBottom: "12px" }}>
                  Your Contact Details
                </legend>
                <div className="field-grid">
                  <label className="field field-wide">
                    <span>Your Name *</span>
                    <input
                      id="checkout-name"
                      name="name"
                      required
                      autoComplete="name"
                      enterKeyHint="next"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        clearFieldError("name");
                      }}
                      aria-invalid={fieldErrors.name ? true : undefined}
                      aria-describedby={fieldErrors.name ? "checkout-name-error" : undefined}
                      placeholder="Jane Doe"
                    />
                    <FieldError id="checkout-name-error" message={fieldErrors.name} />
                  </label>

                  <label className="field">
                    <span>Email Address *</span>
                    <input
                      id="checkout-email"
                      name="email"
                      required
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                      value={customerEmail}
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        clearFieldError("email");
                      }}
                      aria-invalid={fieldErrors.email ? true : undefined}
                      aria-describedby={fieldErrors.email ? "checkout-email-error" : undefined}
                      placeholder="jane@example.com"
                    />
                    <FieldError id="checkout-email-error" message={fieldErrors.email} />
                  </label>

                  <label className="field">
                    <span>Phone Number *</span>
                    <input
                      id="checkout-phone"
                      name="phone"
                      required
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      enterKeyHint="next"
                      value={customerPhone}
                      aria-invalid={fieldErrors.phone ? true : undefined}
                      aria-describedby={
                        fieldErrors.phone ? "checkout-phone-error" : "checkout-phone-hint"
                      }
                      onChange={(e) => {
                        setCustomerPhone(e.target.value.replace(/[^0-9()+\-\s]/g, ""));
                        clearFieldError("phone");
                      }}
                      placeholder="(501) 555-0123"
                    />
                    {fieldErrors.phone ? (
                      <FieldError id="checkout-phone-error" message={fieldErrors.phone} />
                    ) : (
                      <small id="checkout-phone-hint" className="field-hint">
                        The shop texts or calls if anything changes with your order.
                      </small>
                    )}
                  </label>
                </div>
              </fieldset>

              {/* Delivery Choice */}
              <fieldset
                className="form-section"
                style={{ border: "none", padding: 0, margin: "0 0 24px" }}
              >
                <legend style={{ fontWeight: 800, fontSize: "1.05rem", marginBottom: "12px" }}>
                  Delivery Method *
                </legend>
                <div className="method-picker-grid">
                  <button
                    type="button"
                    onClick={() => {
                      setMethod("pickup");
                      clearFieldError("shippingRate");
                    }}
                    className={`method-card ${method === "pickup" ? "selected" : ""}`}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: method === "pickup" ? "#f6c453" : "#fff2cc",
                        color: "#241408",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <MapPin size={18} />
                    </div>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.95rem" }}>
                        Bakery Pickup
                      </strong>
                      <small style={{ color: method === "pickup" ? "#fce8c3" : "#8c6f4a" }}>
                        Free pickup in Searcy / Little Rock
                      </small>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod("shipping")}
                    disabled={cartHasUnshippable}
                    className={`method-card ${method === "shipping" ? "selected" : ""}`}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: method === "shipping" ? "#f6c453" : "#fff2cc",
                        color: "#241408",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Truck size={18} />
                    </div>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.95rem" }}>
                        Ship it to me
                      </strong>
                      <small style={{ color: method === "shipping" ? "#fce8c3" : "#8c6f4a" }}>
                        Direct shipping via USPS
                      </small>
                    </div>
                  </button>
                </div>

                {cartHasUnshippable ? (
                  <small
                    className="field-hint"
                    style={{ marginTop: "8px", display: "block", color: "#8c2f1f" }}
                  >
                    Some items in your cart are bakery pickup only, so shipping is not available for
                    this cart.
                  </small>
                ) : null}
              </fieldset>

              {/* Pickup Sub-Form */}
              {method === "pickup" ? (
                <fieldset
                  className="form-section"
                  style={{ border: "none", padding: 0, margin: "0 0 20px" }}
                >
                  <legend style={{ fontWeight: 800, fontSize: "1.05rem", marginBottom: "12px" }}>
                    Pickup Time & Spot
                  </legend>

                  {!todayHasSlots ? (
                    <div
                      style={{
                        background: "#fff9eb",
                        border: "1.5px solid #d8ae6a",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        marginBottom: "14px",
                        fontSize: "0.86rem",
                        lineHeight: 1.45,
                      }}
                    >
                      <strong style={{ display: "block", color: "#2a160d", marginBottom: "2px" }}>
                        Same-day pickup for today has closed
                      </strong>
                      <span style={{ color: "#4a2a12" }}>
                        Online orders for today close 30 minutes before 11 PM CST. You can pre-order
                        for tomorrow or any upcoming date below, or switch to{" "}
                        <strong>Ship it to me</strong> for direct delivery!
                      </span>
                    </div>
                  ) : null}

                  <div className="field-grid">
                    <div className="field field-wide">
                      <label
                        htmlFor="checkout-pickupLocationId"
                        className="field-label is-required"
                      >
                        Pickup Location
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
                        describedBy={
                          fieldErrors.pickupLocationId
                            ? "checkout-pickupLocationId-error"
                            : undefined
                        }
                      />
                      <FieldError
                        id="checkout-pickupLocationId-error"
                        message={fieldErrors.pickupLocationId}
                      />

                      {selectedLocation ? (
                        <div
                          className="location-callout"
                          role="region"
                          aria-label="Selected pickup spot details"
                          style={{ marginTop: "12px" }}
                        >
                          <div className="location-callout-header">
                            <MapPin
                              size={15}
                              aria-hidden="true"
                              className="location-callout-icon"
                            />
                            <span className="location-callout-name">{selectedLocation.name}</span>
                            {selectedLocation.phone ? (
                              <span className="location-callout-phone">
                                · {selectedLocation.phone}
                              </span>
                            ) : null}
                          </div>
                          <p className="location-callout-address">{selectedLocation.address}</p>
                          {selectedLocation.instructions ? (
                            <p className="location-callout-instructions">
                              <strong>Pickup notes:</strong> {selectedLocation.instructions}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="field">
                      <label htmlFor="checkout-pickupDate" className="field-label is-required">
                        Pickup Date
                      </label>
                      <DatePicker
                        id="checkout-pickupDate"
                        value={pickupDate}
                        onChange={changeDate}
                        min={minDate}
                        max={maxDate}
                        invalid={Boolean(fieldErrors.pickupDate)}
                        describedBy={
                          fieldErrors.pickupDate ? "checkout-pickupDate-error" : undefined
                        }
                      />
                      <FieldError id="checkout-pickupDate-error" message={fieldErrors.pickupDate} />
                    </div>

                    <div className="field">
                      <label htmlFor="checkout-pickupTime" className="field-label is-required">
                        Pickup Time Slot
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
                        describedBy={
                          fieldErrors.pickupTime
                            ? "checkout-pickupTime-error"
                            : "checkout-pickupTime-hint"
                        }
                      />
                      {fieldErrors.pickupTime ? (
                        <FieldError
                          id="checkout-pickupTime-error"
                          message={fieldErrors.pickupTime}
                        />
                      ) : (
                        <small id="checkout-pickupTime-hint" className="field-hint">
                          {noSlotsLeft
                            ? "No more pickup times today. Choose another date."
                            : "Open 11 AM to 11 PM. Same-day orders need 30 minutes."}
                        </small>
                      )}
                    </div>

                    <label className="field field-wide">
                      <span className="optional-label">
                        Pickup Notes <em>(optional)</em>
                      </span>
                      <textarea
                        name="notes"
                        rows={2}
                        maxLength={500}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Allergies, who will pick this up, or any instructions"
                      />
                    </label>
                  </div>
                </fieldset>
              ) : (
                /* Shipping Address Sub-Form */
                <fieldset
                  className="form-section"
                  style={{ border: "none", padding: 0, margin: "0 0 20px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <legend style={{ fontWeight: 800, fontSize: "1.05rem", margin: 0 }}>
                      Shipping Address
                    </legend>
                    {isQuoting ? (
                      <span className="address-status-pill quoting">
                        <RefreshCw size={12} className="spin" /> Checking live USPS rates...
                      </span>
                    ) : rateOptions.length > 0 && isAddressComplete ? (
                      <span className="address-status-pill ready">
                        <Check size={12} /> Rates calculated ({rateOptions.length} option
                        {rateOptions.length > 1 ? "s" : ""})
                      </span>
                    ) : null}
                  </div>

                  <div className="field-grid">
                    <label className="field field-wide">
                      <span>Recipient Name *</span>
                      <input
                        id="checkout-shipName"
                        value={shipName}
                        autoComplete="shipping name"
                        onChange={(e) => {
                          setShipName(e.target.value);
                          clearFieldError("shipName");
                        }}
                        aria-invalid={fieldErrors.shipName ? true : undefined}
                        aria-describedby={
                          fieldErrors.shipName ? "checkout-shipName-error" : undefined
                        }
                        placeholder="Jane Doe"
                      />
                      <FieldError id="checkout-shipName-error" message={fieldErrors.shipName} />
                    </label>

                    <label className="field field-wide">
                      <span>Street Address *</span>
                      <input
                        id="checkout-shipLine1"
                        value={shipLine1}
                        autoComplete="shipping address-line1"
                        onChange={(e) => {
                          setShipLine1(e.target.value);
                          clearFieldError("shipLine1");
                        }}
                        aria-invalid={fieldErrors.shipLine1 ? true : undefined}
                        aria-describedby={
                          fieldErrors.shipLine1 ? "checkout-shipLine1-error" : undefined
                        }
                        placeholder="123 Sweet Treat Ln"
                      />
                      <FieldError id="checkout-shipLine1-error" message={fieldErrors.shipLine1} />
                    </label>

                    <label className="field field-wide">
                      <span className="optional-label">
                        Apartment / Suite <em>(optional)</em>
                      </span>
                      <input
                        value={shipLine2}
                        autoComplete="shipping address-line2"
                        onChange={(e) => setShipLine2(e.target.value)}
                        placeholder="Apt 4B"
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
                          clearFieldError("shipCity");
                        }}
                        aria-invalid={fieldErrors.shipCity ? true : undefined}
                        aria-describedby={
                          fieldErrors.shipCity ? "checkout-shipCity-error" : undefined
                        }
                        placeholder="Little Rock"
                      />
                      <FieldError id="checkout-shipCity-error" message={fieldErrors.shipCity} />
                    </label>

                    <label className="field" style={{ maxWidth: "120px" }}>
                      <span>State *</span>
                      <input
                        id="checkout-shipState"
                        value={shipState}
                        maxLength={2}
                        autoComplete="shipping address-level1"
                        onChange={(e) => {
                          setShipState(e.target.value.toUpperCase());
                          clearFieldError("shipState");
                        }}
                        aria-invalid={fieldErrors.shipState ? true : undefined}
                        aria-describedby={
                          fieldErrors.shipState ? "checkout-shipState-error" : undefined
                        }
                        placeholder="AR"
                      />
                      <FieldError id="checkout-shipState-error" message={fieldErrors.shipState} />
                    </label>

                    <label className="field">
                      <span>ZIP Code *</span>
                      <input
                        id="checkout-shipZip"
                        value={shipZip}
                        inputMode="numeric"
                        maxLength={10}
                        autoComplete="shipping postal-code"
                        onChange={(e) => {
                          setShipZip(e.target.value);
                          clearFieldError("shipZip");
                        }}
                        aria-invalid={fieldErrors.shipZip ? true : undefined}
                        aria-describedby={
                          fieldErrors.shipZip ? "checkout-shipZip-error" : undefined
                        }
                        placeholder="72201"
                      />
                      <FieldError id="checkout-shipZip-error" message={fieldErrors.shipZip} />
                    </label>

                    <label className="field field-wide">
                      <span className="optional-label">
                        Gift Message or Delivery Instructions <em>(optional)</em>
                      </span>
                      <textarea
                        name="notes"
                        rows={2}
                        maxLength={500}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Allergies, gift note for recipient, gate code, etc."
                      />
                    </label>
                  </div>
                </fieldset>
              )}

              {/* Step 1 Continue Button */}
              <div style={{ marginTop: "20px" }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleProceedToStep2}
                  style={{
                    width: "100%",
                    minHeight: "48px",
                    fontSize: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <span>
                    {method === "shipping"
                      ? "Continue to shipping options"
                      : "Continue to order review"}
                  </span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* STEP 2: REVIEW DETAILS & CHOOSE SHIPPING RATE             */
            /* ========================================================== */
            <div>
              {/* Summary Card with Edit Trigger */}
              <div className="checkout-summary-card">
                <div className="checkout-summary-row">
                  <div>
                    <div className="checkout-summary-label">Contact</div>
                    <div className="checkout-summary-val">
                      {customerName} · {customerEmail} · {customerPhone}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("details")}
                    className="ghost-button"
                    style={{
                      fontSize: "0.82rem",
                      padding: "4px 10px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                </div>

                <div
                  style={{
                    borderTop: "1px dashed #ead8bf",
                    paddingTop: "10px",
                  }}
                  className="checkout-summary-row"
                >
                  <div>
                    <div className="checkout-summary-label">
                      {method === "shipping" ? "Shipping To" : "Pickup Location & Time"}
                    </div>
                    <div className="checkout-summary-val">
                      {method === "shipping" ? (
                        <>
                          <strong>{shipName}</strong>
                          <br />
                          {shipLine1}
                          {shipLine2 ? `, ${shipLine2}` : ""}
                          <br />
                          {shipCity}, {shipState} {shipZip}
                        </>
                      ) : (
                        <>
                          <strong>{selectedLocation?.name || "Bakery"}</strong>
                          <br />
                          {selectedLocation?.address}
                          <br />
                          Date: <strong>{pickupDate}</strong> at <strong>{pickupTime}</strong>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("details")}
                    className="ghost-button"
                    style={{
                      fontSize: "0.82rem",
                      padding: "4px 10px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Edit2 size={13} /> Change
                  </button>
                </div>

                {notes ? (
                  <div
                    style={{
                      borderTop: "1px dashed #ead8bf",
                      paddingTop: "10px",
                    }}
                  >
                    <div className="checkout-summary-label">Special Notes</div>
                    <div
                      className="checkout-summary-val"
                      style={{ fontStyle: "italic", fontSize: "0.88rem" }}
                    >
                      &quot;{notes}&quot;
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Shipping Rate Selection (for delivery orders) */}
              {method === "shipping" ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: "1.15rem", margin: 0, fontWeight: 800 }}>
                        Select Shipping Speed
                      </h2>
                      <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.86rem" }}>
                        All orders are freshly baked and protected in insulated packaging.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => loadRates(false)}
                      disabled={isQuoting}
                      className="ghost-button"
                      style={{
                        fontSize: "0.82rem",
                        padding: "4px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <RefreshCw size={13} className={isQuoting ? "spin" : ""} />
                      {isQuoting ? "Checking..." : "Refresh rates"}
                    </button>
                  </div>

                  {/* Quoting Error Banner */}
                  {quoteError ? (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        background: "#fff2f0",
                        border: "1.5px solid #ffccc7",
                        marginBottom: "14px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                      }}
                    >
                      <AlertCircle
                        size={18}
                        style={{ color: "#b3261e", flexShrink: 0, marginTop: "2px" }}
                      />
                      <div style={{ flex: 1, fontSize: "0.88rem" }}>
                        <strong style={{ color: "#b3261e" }}>Shipping quote error</strong>
                        <p style={{ margin: "2px 0 8px", color: "#4a120e" }}>{quoteError}</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => setStep("details")}
                            className="text-link"
                            style={{ fontSize: "0.84rem", fontWeight: 700 }}
                          >
                            Edit delivery address &rarr;
                          </button>
                          <button
                            type="button"
                            onClick={() => loadRates(false)}
                            className="text-link"
                            style={{ fontSize: "0.84rem", fontWeight: 700 }}
                          >
                            Try again
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Loading Skeletons */}
                  {isQuoting ? (
                    <div style={{ display: "grid", gap: "10px", margin: "14px 0" }}>
                      {[1, 2].map((i) => (
                        <div key={i} className="shipping-skeleton-card">
                          <Package size={20} style={{ color: "#d8ae6a", opacity: 0.7 }} />
                          <div style={{ flex: 1 }}>
                            <div
                              className="skeleton skeleton-title"
                              style={{ width: "160px", height: "16px", marginBottom: "6px" }}
                            ></div>
                            <div
                              className="skeleton skeleton-text"
                              style={{ width: "100px", height: "12px" }}
                            ></div>
                          </div>
                          <div
                            className="skeleton"
                            style={{ width: "60px", height: "20px", borderRadius: "4px" }}
                          ></div>
                        </div>
                      ))}
                      <p
                        className="muted"
                        style={{ fontSize: "0.82rem", textAlign: "center", margin: "4px 0" }}
                      >
                        Finding best USPS shipping rates for your address...
                      </p>
                    </div>
                  ) : rateOptions.length > 0 ? (
                    /* Populated Rate Option Cards */
                    <div className="shipping-options-list">
                      {rateOptions.map((option) => {
                        const isCheapest =
                          lowestRateAmount != null && option.amountCents === lowestRateAmount;
                        const isFastest =
                          !isCheapest &&
                          fastestDays != null &&
                          option.estimatedDays === fastestDays;
                        const isSelected = selectedRate === option.title;

                        return (
                          <label
                            key={option.title}
                            className={`shipping-option-card ${isSelected ? "selected" : ""}`}
                          >
                            <input
                              type="radio"
                              name="shippingRate"
                              value={option.title}
                              checked={isSelected}
                              onChange={() => {
                                setSelectedRate(option.title);
                                clearFieldError("shippingRate");
                              }}
                              style={{ width: "18px", height: "18px", accentColor: "#241408" }}
                            />

                            <div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  gap: "6px",
                                }}
                              >
                                <strong style={{ fontSize: "0.98rem", color: "#1b0f08" }}>
                                  {option.title}
                                </strong>
                                {isCheapest ? (
                                  <span className="shipping-badge-cheapest">
                                    ★ Cheapest / Best Value
                                  </span>
                                ) : null}
                                {isFastest ? (
                                  <span className="shipping-badge-fastest">
                                    ⚡ Fastest Delivery
                                  </span>
                                ) : null}
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  marginTop: "3px",
                                }}
                              >
                                {option.estimatedDays != null ? (
                                  <small
                                    style={{
                                      color: "#7a5000",
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <Clock size={13} />
                                    {option.estimatedDays === 1
                                      ? "Estimated 1 business day"
                                      : `Estimated ${option.estimatedDays} business days`}
                                  </small>
                                ) : (
                                  <small style={{ color: "#7a5000" }}>USPS standard delivery</small>
                                )}
                              </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <strong style={{ fontSize: "1.1rem", display: "block" }}>
                                {formatMoney(option.amountCents)}
                              </strong>
                              {handlingFeeCents > 0 ? (
                                <small style={{ color: "#8c6f4a", fontSize: "0.78rem" }}>
                                  +{formatMoney(handlingFeeCents)} fee
                                </small>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}

                      {handlingFeeCents > 0 ? (
                        <p className="field-hint" style={{ marginTop: "6px", fontSize: "0.82rem" }}>
                          A {formatMoney(handlingFeeCents)} bakery handling fee is included to cover
                          moisture-sealed, insulated packaging.
                        </p>
                      ) : null}

                      <FieldError
                        id="checkout-shippingRate-error"
                        message={fieldErrors.shippingRate}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "16px",
                        border: "1.5px dashed #ead8bf",
                        borderRadius: "8px",
                        textAlign: "center",
                      }}
                    >
                      <p className="muted" style={{ margin: "0 0 10px" }}>
                        No shipping rates currently loaded.
                      </p>
                      <button
                        type="button"
                        onClick={() => loadRates(false)}
                        className="primary-button"
                        style={{ fontSize: "0.88rem" }}
                      >
                        Fetch shipping rates
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Pickup Confirmation Card */
                <div
                  style={{
                    padding: "16px",
                    background: "#fffef8",
                    border: "1.5px solid #ead8bf",
                    borderRadius: "8px",
                  }}
                >
                  <h2 style={{ fontSize: "1.15rem", margin: "0 0 10px", fontWeight: 800 }}>
                    Pickup Confirmation
                  </h2>
                  <p style={{ margin: "0 0 6px", fontSize: "0.92rem" }}>
                    Your order will be freshly prepared for pickup at{" "}
                    <strong>{selectedLocation?.name}</strong>.
                  </p>
                  <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
                    Pickup schedule: <strong>{pickupDate}</strong> at <strong>{pickupTime}</strong>.
                    Please bring a photo ID or order confirmation email.
                  </p>
                </div>
              )}

              {/* Navigation Actions */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "24px",
                  paddingTop: "16px",
                  borderTop: "1px solid #ead8bf",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  className="ghost-button"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <ArrowLeft size={16} /> Back to details
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting || (method === "shipping" && !selectedRate)}
                  className="primary-button"
                  style={{
                    minHeight: "46px",
                    padding: "0 24px",
                    fontSize: "0.98rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Lock size={15} />
                  <span>{isSubmitting ? "Connecting to checkout..." : "Proceed to Checkout"}</span>
                </button>
              </div>
            </div>
          )}

          {error ? (
            <p className="form-error" role="alert" style={{ marginTop: "16px" }}>
              {error}
            </p>
          ) : null}
        </section>

        {/* ORDER SUMMARY ASIDE */}
        <aside className="panel" style={{ alignSelf: "start" }}>
          <p className="eyebrow">Order summary</p>

          <div style={{ margin: "12px 0 16px", display: "grid", gap: "10px" }}>
            {cart.lines.map((line) => (
              <div
                key={line.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.92rem",
                }}
              >
                <span>
                  <strong>{line.quantity}x</strong> {line.name}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {formatMoney(line.priceCents * line.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              borderTop: "1px solid #d8ae6a",
              paddingTop: "12px",
              display: "grid",
              gap: "6px",
              fontSize: "0.88rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted">Items Subtotal</span>
              <span>{formatMoney(cart.subtotalCents)}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted">{method === "shipping" ? "Shipping" : "Bakery Pickup"}</span>
              <span>
                {method === "pickup" ? (
                  <strong style={{ color: "#1e6d2b" }}>FREE</strong>
                ) : selectedRateOption ? (
                  formatMoney(selectedRateOption.amountCents)
                ) : (
                  <span className="muted" style={{ fontStyle: "italic" }}>
                    {rateOptions.length > 0
                      ? formatMoney(rateOptions[0].amountCents)
                      : "Calculated next"}
                  </span>
                )}
              </span>
            </div>

            {method === "shipping" && handlingFeeCents > 0 ? (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Packaging & Handling</span>
                <span>{formatMoney(handlingFeeCents)}</span>
              </div>
            ) : null}
          </div>

          <div
            style={{
              borderTop: "2px solid #2a160d",
              marginTop: "12px",
              paddingTop: "12px",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: "1.05rem" }}>Total</span>
            <h2 style={{ margin: 0, fontSize: "1.6rem", fontFamily: "var(--font-display)" }}>
              {formatMoney(
                method === "shipping" && selectedRateOption
                  ? cart.subtotalCents + shippingTotalCents
                  : method === "shipping" && rateOptions.length > 0 && !selectedRateOption
                    ? cart.subtotalCents + rateOptions[0].amountCents + handlingFeeCents
                    : cart.subtotalCents,
              )}
            </h2>
          </div>

          <div style={{ marginTop: "18px" }}>
            {step === "details" ? (
              <button
                type="button"
                className="primary-button"
                style={{ width: "100%", minHeight: "46px" }}
                onClick={handleProceedToStep2}
              >
                {method === "shipping" ? "Continue to shipping →" : "Continue to review →"}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                style={{ width: "100%", minHeight: "46px" }}
                disabled={isSubmitting || (method === "shipping" && !selectedRate)}
                onClick={handleFinalSubmit}
              >
                {isSubmitting ? "Connecting to checkout..." : "Proceed to Checkout →"}
              </button>
            )}
          </div>

          {/* Trust Guarantees */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "14px",
              borderTop: "1px dashed #ead8bf",
              display: "grid",
              gap: "8px",
              fontSize: "0.78rem",
              color: "#7a5000",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldCheck size={14} style={{ color: "#1e6d2b" }} />
              <span>Encrypted 256-bit secure checkout</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} style={{ color: "#b9823b" }} />
              <span>Baked fresh in Searcy, Arkansas</span>
            </div>
            {method === "shipping" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Truck size={14} style={{ color: "#1a569c" }} />
                <span>USPS tracking provided on shipment</span>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
