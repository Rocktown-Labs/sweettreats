import Stripe from "stripe";
import { env } from "@sweettreats/env/server";

/**
 * Module-cached Stripe client. Omitting apiVersion pins the SDK's default
 * (current best practice: always ride the latest API version).
 *
 * Checkout sessions must NOT hardcode payment_method_types — dynamic payment
 * methods are the default and rank eligible methods for conversion.
 */
let stripeClient: Stripe | null | undefined;

export function getStripeClient(): Stripe | null {
  if (stripeClient !== undefined) {
    return stripeClient;
  }
  const stripeSecretKey = (env as Record<string, unknown>).STRIPE_SECRET_KEY as string | undefined;
  stripeClient = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
  return stripeClient;
}

/**
 * Tags checkout sessions in the Stripe Dashboard per
 * integration_identifier guidance (label + 8 random letters).
 */
export const CHECKOUT_INTEGRATION_ID = "sweettreats-checkout-Kq4Mz7Xr";
