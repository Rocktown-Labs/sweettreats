import { env } from "@sweettreats/env/server";

/**
 * Capability token for guest order confirmation pages.
 *
 * Guests have no session and no Stripe session id for pay-on-pickup orders,
 * so the success URL carries a short HMAC of the order id keyed by the
 * auth secret. Knowing an orderId alone is never enough to read an order.
 */

const encoder = new TextEncoder();

function authSecret(): string {
  const processEnv = typeof process === "undefined" ? undefined : process.env.BETTER_AUTH_SECRET;
  const secret = String((env as Record<string, unknown>).BETTER_AUTH_SECRET ?? processEnv ?? "");
  return secret;
}

async function signOrderId(orderId: string): Promise<string> {
  const secret = authSecret();
  if (!secret) {
    // No secret configured (bare dev without wrangler). Only used locally.
    return "";
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`order:${orderId}`));
  const bytes = new Uint8Array(signature);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex.slice(0, 32);
}

export async function createOrderToken(orderId: string): Promise<string> {
  return signOrderId(orderId);
}

export async function verifyOrderToken(
  orderId: string,
  token: string | undefined,
): Promise<boolean> {
  const secret = authSecret();
  if (!secret) {
    // A missing secret means tokens cannot be verified; deny rather than
    // authorize every order. Production always sets BETTER_AUTH_SECRET.
    return false;
  }
  if (!token) {
    return false;
  }
  const expected = await signOrderId(orderId);
  // Constant-time-ish comparison for a 32-char hex string.
  let diff = expected.length ^ token.length;
  for (let index = 0; index < Math.max(expected.length, token.length); index += 1) {
    diff |= (expected.charCodeAt(index) || 0) ^ (token.charCodeAt(index) || 0);
  }
  return diff === 0;
}
