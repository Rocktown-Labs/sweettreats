import Stripe from "stripe";

import { INTEGRATION_KEY_IDS, resolveIntegrationKey } from "./secure-settings";

/**
 * Module-cached Stripe client, keyed by the resolved secret so a key change
 * (Admin → Integrations sheet) self-invalidates without a redeploy.
 *
 * Resolution order: sheet (admin-managed, encrypted in D1) → env var →
 * unset. Checkout sessions must NOT hardcode payment_method_types — dynamic
 * payment methods are the default and rank eligible methods for conversion.
 */
let cached: { key: string; client: Stripe } | null = null;

export async function getStripeClient(): Promise<Stripe | null> {
  const key = await resolveIntegrationKey(INTEGRATION_KEY_IDS.stripeSecret);
  if (!key) {
    return null;
  }
  if (cached?.key === key) {
    return cached.client;
  }
  cached = { key, client: new Stripe(key) };
  return cached.client;
}

/** The current resolved secret's mode, for admin-facing status displays. */
export async function currentStripeMode(): Promise<"test" | "live" | null> {
  const key = await resolveIntegrationKey(INTEGRATION_KEY_IDS.stripeSecret);
  if (!key) return null;
  return key.startsWith("sk_live_") ? "live" : "test";
}

/** Validating constructor used by the sheet save flow — never cached. */
export function stripeClientFor(key: string): Stripe {
  return new Stripe(key);
}

/**
 * Tags checkout sessions in the Stripe Dashboard per
 * integration_identifier guidance (label + 8 random letters).
 */
export const CHECKOUT_INTEGRATION_ID = "sweettreats-checkout-Kq4Mz7Xr";
