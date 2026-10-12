import { Link, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { useCart } from "../lib/cart";
import { createOrder, getPickupAvailability } from "../lib/api";
import { formatMoney } from "../lib/format";
import { authClient } from "../lib/auth-client";
import { PICKUP_WINDOW_DAYS, addDaysIso, pickupSlots } from "../lib/pickup";
import { DatePicker } from "../components/date-picker";
import { TimePicker } from "../components/time-picker";

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

type FieldName = "name" | "email" | "phone" | "pickupDate" | "pickupTime";
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
  const cart = useCart();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const submitOrder = useServerFn(createOrder);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setSubmitting] = useState(false);
  const [pickupDate, setPickupDate] = useState(pickup.pickupDate);
  const [pickupTime, setPickupTime] = useState("");

  // Slots depend on "now" in the shop's time zone, so compute them on the client after mount-time
  // renders and whenever the date changes.
  const slots = useMemo(() => pickupSlots(pickupDate), [pickupDate]);
  const noSlotsLeft = slots.every((slot) => slot.disabled);
  const minDate = pickup.pickupDate;
  const maxDate = addDaysIso(minDate, PICKUP_WINDOW_DAYS);

  const clearFieldError = (field: FieldName) =>
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const changeDate = (next: string) => {
    setPickupDate(next);
    clearFieldError("pickupDate");
    // A time that was fine for tomorrow may already be in the past for today.
    const stillValid = pickupSlots(next).some(
      (slot) => slot.value === pickupTime && !slot.disabled,
    );
    if (!stillValid) {
      setPickupTime("");
    }
  };

  const validate = (form: FormData): FieldErrors => {
    const errors: FieldErrors = {};
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();

    if (name.length < 2) errors.name = "Enter your name so we know who to hand the order to.";
    if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
    if (!PHONE_PATTERN.test(phone)) errors.phone = "Enter a phone number we can reach you at.";
    if (!pickupDate) errors.pickupDate = "Choose a pickup date.";
    if (!pickupTime) {
      errors.pickupTime = "Choose a pickup time.";
    } else if (!slots.some((slot) => slot.value === pickupTime && !slot.disabled)) {
      errors.pickupTime = "That time has passed. Pick a later slot.";
    }

    return errors;
  };

  // The cart hydrates from localStorage after mount; don't flash the empty state before then.
  if (!cart.ready) {
    return <CheckoutPending />;
  }

  if (!cart.lines.length && !isSubmitting) {
    return (
      <main className="page">
        <div className="section-head">
          <div>
            <p className="eyebrow">Pickup details</p>
            <h1 className="page-title">Send order</h1>
          </div>
        </div>
        <section className="panel empty-state">
          <p>Your cart is empty. Add a few cookies to place an order.</p>
          <Link to="/menu" className="primary-button">
            Browse the menu
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Pickup details</p>
          <h1 className="page-title">Send order</h1>
          <p className="muted">
            Continue as a guest, or{" "}
            <Link to="/sign-in" search={{ redirect: "/checkout" }}>
              log in
            </Link>{" "}
            before ordering to keep order history.
          </p>
        </div>
      </div>
      <form
        className="layout-two"
        noValidate
        aria-busy={isSubmitting}
        onSubmit={async (event) => {
          event.preventDefault();
          if (isSubmitting) {
            return;
          }

          setError("");
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          const errors = validate(form);
          setFieldErrors(errors);

          const firstInvalid = (Object.keys(errors) as FieldName[]).find((key) => errors[key]);
          if (firstInvalid) {
            formElement.querySelector<HTMLElement>(`#checkout-${firstInvalid}`)?.focus();
            return;
          }

          setSubmitting(true);
          try {
            const result = await submitOrder({
              data: {
                name: String(form.get("name") ?? "").trim(),
                email: String(form.get("email") ?? "").trim(),
                phone: String(form.get("phone") ?? "").trim(),
                pickupDate,
                pickupTime,
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
        }}
      >
        <section className="form-panel">
          {pickup.closed ? (
            <p className="form-notice" role="status">
              We don&apos;t have an open pickup day in the next few weeks. You can still send an
              order and the shop will confirm a day with you.
            </p>
          ) : null}
          <p className="required-note">
            <span aria-hidden="true">*</span> Required
          </p>

          <fieldset className="form-section">
            <legend>Your details</legend>
            <div className="field-grid">
              <label className="field field-wide">
                <span>Name</span>
                <input
                  id="checkout-name"
                  name="name"
                  required
                  autoComplete="name"
                  enterKeyHint="next"
                  defaultValue={session?.user?.name || ""}
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? "checkout-name-error" : undefined}
                  onChange={() => clearFieldError("name")}
                />
                <FieldError id="checkout-name-error" message={fieldErrors.name} />
              </label>
              <label className="field">
                <span>Email</span>
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
                  defaultValue={session?.user?.email || ""}
                  aria-invalid={fieldErrors.email ? true : undefined}
                  aria-describedby={fieldErrors.email ? "checkout-email-error" : undefined}
                  onChange={() => clearFieldError("email")}
                />
                <FieldError id="checkout-email-error" message={fieldErrors.email} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  id="checkout-phone"
                  name="phone"
                  required
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  enterKeyHint="next"
                  aria-invalid={fieldErrors.phone ? true : undefined}
                  aria-describedby={
                    fieldErrors.phone ? "checkout-phone-error" : "checkout-phone-hint"
                  }
                  onInput={(event) => {
                    event.currentTarget.value = event.currentTarget.value.replace(
                      /[^0-9()+\-\s]/g,
                      "",
                    );
                    clearFieldError("phone");
                  }}
                />
                {fieldErrors.phone ? (
                  <FieldError id="checkout-phone-error" message={fieldErrors.phone} />
                ) : (
                  <small id="checkout-phone-hint" className="field-hint">
                    The shop texts or calls if anything changes.
                  </small>
                )}
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Pickup</legend>
            <div className="field-grid">
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
                  describedBy={fieldErrors.pickupDate ? "checkout-pickupDate-error" : undefined}
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
                  describedBy={
                    fieldErrors.pickupTime
                      ? "checkout-pickupTime-error"
                      : "checkout-pickupTime-hint"
                  }
                />
                {fieldErrors.pickupTime ? (
                  <FieldError id="checkout-pickupTime-error" message={fieldErrors.pickupTime} />
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
                  Notes <em>(optional)</em>
                </span>
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={500}
                  placeholder="Allergies, a name for the pickup, anything we should know"
                />
              </label>
            </div>
          </fieldset>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
        <aside className="panel">
          <p className="eyebrow">Order summary</p>
          {cart.lines.map((line) => (
            <p key={line.id}>
              {line.quantity} x {line.name}
            </p>
          ))}
          <h2>{formatMoney(cart.subtotalCents)}</h2>
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send order"}
          </button>
        </aside>
      </form>
    </main>
  );
}
