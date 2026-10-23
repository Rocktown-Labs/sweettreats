import { createDb } from "@sweettreats/db";
import { apiKeys } from "@sweettreats/db/schema/index";
import { eq, sql } from "drizzle-orm";
import { env } from "@sweettreats/env/server";

import { logger } from "./logger";

/**
 * Admin-managed API keys (the Admin → Integrations sheet).
 *
 * Storage: AES-GCM encrypted at rest in the `api_keys` table. The encryption
 * key is derived from BETTER_AUTH_SECRET (a Worker secret, never in the
 * database), so a database export alone can never reveal the keys — and
 * rotating BETTER_AUTH_SECRET intentionally wipes every stored key (they
 * must be re-entered).
 *
 * Resolution order everywhere: sheet (DB) first, env var fallback, unset
 * last. So the admin's pasted keys override the deploy-time env values the
 * moment they're saved — no redeploy, no GitHub secrets.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const INTEGRATION_KEY_IDS = {
  stripeSecret: "stripe_secret",
  stripePublishable: "stripe_publishable",
  stripeWebhook: "stripe_webhook",
  shippoApi: "shippo_api",
  shippoWebhookToken: "shippo_webhook_token",
} as const;

export type IntegrationKeyId = (typeof INTEGRATION_KEY_IDS)[keyof typeof INTEGRATION_KEY_IDS];

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function encryptionKey(): Promise<CryptoKey | null> {
  const processEnv = typeof process === "undefined" ? undefined : process.env?.BETTER_AUTH_SECRET;
  const secret = String((env as Record<string, unknown>).BETTER_AUTH_SECRET ?? processEnv ?? "");
  if (!secret) {
    return null;
  }
  // Domain-separate from other uses of the auth secret.
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`sweettreats-api-keys:v1:${secret}`),
  );
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await encryptionKey();
  if (!key) {
    throw new Error("Cannot store API keys: BETTER_AUTH_SECRET is not configured.");
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    encoder.encode(plain),
  );
  return `v1:${base64(iv)}:${base64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(stored: string): Promise<string | null> {
  if (!stored.startsWith("v1:")) {
    return null;
  }
  const [, ivPart, dataPart] = stored.split(":");
  if (!ivPart || !dataPart) {
    return null;
  }
  try {
    const key = await encryptionKey();
    if (!key) {
      return null;
    }
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: fromBase64(ivPart) as unknown as BufferSource,
      },
      key,
      fromBase64(dataPart) as unknown as BufferSource,
    );
    return decoder.decode(plain);
  } catch {
    // Wrong key (rotated BETTER_AUTH_SECRET) or corrupted value: treat as unset.
    return null;
  }
}

/** Save (or clear, with empty string) an integration key in the sheet. */
export async function storeIntegrationKey(keyId: IntegrationKeyId, plain: string): Promise<void> {
  const db = createDb();
  if (!plain) {
    await db.delete(apiKeys).where(eq(apiKeys.key, keyId));
    return;
  }
  const value = await encryptSecret(plain);
  await db
    .insert(apiKeys)
    .values({
      key: keyId,
      value,
      last4: plain.slice(-4),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .onConflictDoUpdate({
      target: apiKeys.key,
      set: { value, last4: plain.slice(-4), updatedAt: sql`CURRENT_TIMESTAMP` },
    });
}

/**
 * Resolve an integration key: sheet value first, env var fallback. Returns
 * "" when neither is set. Expensive objects (Stripe/Shippo clients) cache
 * themselves keyed by the resolved value, so a changed key self-invalidates.
 */

function envFallback(keyId: IntegrationKeyId): string {
  const map: Record<IntegrationKeyId, string> = {
    stripe_secret: "STRIPE_SECRET_KEY",
    stripe_publishable: "STRIPE_PUBLISHABLE_KEY",
    stripe_webhook: "STRIPE_WEBHOOK_SECRET",
    shippo_api: "SHIPPO_API_KEY",
    shippo_webhook_token: "SHIPPO_WEBHOOK_TOKEN",
  };
  const name = map[keyId];
  const processEnv = typeof process === "undefined" ? undefined : process.env?.[name];
  return String((env as Record<string, unknown>)[name] ?? processEnv ?? "");
}

export async function resolveIntegrationKey(keyId: IntegrationKeyId): Promise<string> {
  const db = createDb();
  let row: { key: string; value: string } | undefined;
  try {
    row = await db.query.apiKeys.findFirst({ where: eq(apiKeys.key, keyId) });
  } catch {
    row = undefined;
  }

  if (!row) {
    return envFallback(keyId);
  }

  const plain = await decryptSecret(row.value);
  if (plain === null) {
    logger.warn("integrations.key_decrypt_failed", { keyId });
    return envFallback(keyId);
  }
  return plain;
}

/** Masked status for the admin sheet — never returns plaintext. */
export async function integrationKeyStatus(
  keyId: IntegrationKeyId,
): Promise<{ configured: boolean; source: "sheet" | "env" | "none"; last4: string }> {
  const db = createDb();
  let last4 = "";
  let inSheet = false;
  try {
    const row = await db.query.apiKeys.findFirst({ where: eq(apiKeys.key, keyId) });
    if (row) {
      inSheet = true;
      last4 = row.last4;
    }
  } catch {
    // Status display only — degrade gracefully.
  }

  if (inSheet) {
    return { configured: true, source: "sheet", last4 };
  }
  const envValue = envFallback(keyId);
  if (envValue) {
    return { configured: true, source: "env", last4: envValue.slice(-4) };
  }
  return { configured: false, source: "none", last4: "" };
}
