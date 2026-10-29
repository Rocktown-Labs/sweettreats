import { describe, expect, it } from "vitest";

import { expectedCheckoutAmountCents, stripeAmountMatches } from "./stripe-amounts";

const order = {
  totalCents: 2600,
  subtotalCents: 2400,
  shippingCents: 100,
  handlingCents: 100,
};

describe("Stripe amount reconciliation", () => {
  it("accepts the undiscounted total", () => {
    expect(stripeAmountMatches(order, { amount_total: 2600 })).toBe(true);
  });

  it("accepts a promotion-code discount instead of rejecting the payment", () => {
    const session = { amount_total: 2100, total_details: { amount_discount: 500 } };
    expect(expectedCheckoutAmountCents(order, session)).toBe(2100);
    expect(stripeAmountMatches(order, session)).toBe(true);
  });

  it("rejects underpayment that is not explained by a discount", () => {
    expect(stripeAmountMatches(order, { amount_total: 100 })).toBe(false);
    expect(stripeAmountMatches(order, { amount_total: 2500 })).toBe(false);
  });

  it("falls back to line totals for legacy rows with totalCents = 0", () => {
    expect(
      expectedCheckoutAmountCents(
        { totalCents: 0, subtotalCents: 2400, shippingCents: 100, handlingCents: 100 },
        { amount_total: 2600 },
      ),
    ).toBe(2600);
  });

  it("never produces a negative expected amount", () => {
    const session = { amount_total: 0, total_details: { amount_discount: 5000 } };
    expect(expectedCheckoutAmountCents(order, session)).toBe(0);
    expect(stripeAmountMatches(order, session)).toBe(true);
  });
});
