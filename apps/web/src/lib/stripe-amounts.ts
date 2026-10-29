/**
 * Stripe amount reconciliation.
 *
 * `amount_total` is what Stripe actually charged: line items + shipping and
 * handling, minus any promotion-code discount. Comparing it to the order's
 * undiscounted total rejects legitimate discounted checkouts, so the expected
 * amount must account for `total_details.amount_discount`.
 */

export type OrderAmountFields = {
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  handlingCents: number;
};

export type StripeAmountFields = {
  amount_total?: number | null;
  total_details?: { amount_discount?: number | null } | null;
};

export function expectedCheckoutAmountCents(
  order: OrderAmountFields,
  session: StripeAmountFields,
): number {
  const base =
    order.totalCents > 0
      ? order.totalCents
      : order.subtotalCents + order.shippingCents + order.handlingCents;
  const discount = Math.max(0, session.total_details?.amount_discount ?? 0);
  return Math.max(0, base - discount);
}

export function stripeAmountMatches(
  order: OrderAmountFields,
  session: StripeAmountFields,
): boolean {
  return (session.amount_total ?? 0) === expectedCheckoutAmountCents(order, session);
}
