import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Secure-settings contract:
 * - secrets round-trip through AES-GCM with a BETTER_AUTH_SECRET-derived key
 * - a different secret fails to decrypt (rotation wipes stored keys)
 * - format validators used by the sheet reject malformed keys
 */

const envMock = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));

vi.mock("@sweettreats/env/server", () => ({ env: envMock.env }));

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const TEST_SECRET = "test-secret-32-characters-long-ok!";

/** The proxy mock captures one object — mutate it, never reassign. */
function setSecret(value: string | undefined) {
  if (value === undefined) {
    delete envMock.env.BETTER_AUTH_SECRET;
  } else {
    envMock.env.BETTER_AUTH_SECRET = value;
  }
}

// vitest loads the project .env into process.env — save and clear it so the
// "no encryption key" cases actually have no fallback.
let savedProcessSecret: string | undefined;
beforeAll(() => {
  savedProcessSecret = process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_SECRET;
});
afterAll(() => {
  if (savedProcessSecret !== undefined) {
    process.env.BETTER_AUTH_SECRET = savedProcessSecret;
  }
});

describe("secure-settings crypto", () => {
  it("round-trips a secret through encrypt → decrypt", async () => {
    setSecret(TEST_SECRET);
    const { encryptSecret, decryptSecret } = await import("./secure-settings");
    const stored = await encryptSecret("sk_live_example_1234");
    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain("sk_live_example");
    expect(await decryptSecret(stored)).toBe("sk_live_example_1234");
  });

  it("refuses to store when no encryption key is configured", async () => {
    setSecret(undefined);
    const { encryptSecret } = await import("./secure-settings");
    await expect(encryptSecret("sk_test_x")).rejects.toThrow(/BETTER_AUTH_SECRET/);
    setSecret(TEST_SECRET);
  });

  it("fails decryption under a rotated secret (stored keys are wiped)", async () => {
    setSecret(TEST_SECRET);
    const { encryptSecret } = await import("./secure-settings");
    const stored = await encryptSecret("shippo_test_abcdef");

    setSecret("a-totally-different-secret-32-chars");
    const { decryptSecret } = await import("./secure-settings");
    expect(await decryptSecret(stored)).toBeNull();
    setSecret(TEST_SECRET);
  });

  it("rejects malformed stored values", async () => {
    setSecret(TEST_SECRET);
    const { decryptSecret } = await import("./secure-settings");
    expect(await decryptSecret("not json")).toBeNull();
    expect(await decryptSecret("v1:only-one-part")).toBeNull();
    expect(await decryptSecret("v1:!!!:!!!")).toBeNull(); // invalid base64 → decrypt throws → null
  });
});

describe("integration key formats (sheet validators)", () => {
  const stripeSecret = /^sk_(test|live)_/;
  const publishable = /^pk_(test|live)_/;
  const webhook = /^whsec_/;
  const shippo = /^shippo_(test|live)_/;

  it("accepts real prefixes and rejects lookalikes", () => {
    expect(stripeSecret.test("sk_test_51USjARabc")).toBe(true);
    expect(stripeSecret.test("sk_live_51USjARabc")).toBe(true);
    expect(stripeSecret.test("rk_live_abc")).toBe(false); // restricted key — not a secret key
    expect(stripeSecret.test("pk_test_abc")).toBe(false);

    expect(publishable.test("pk_live_abc")).toBe(true);
    expect(webhook.test("whsec_abc")).toBe(true);
    expect(webhook.test("sk_test_abc")).toBe(false);

    expect(shippo.test("shippo_test_abc")).toBe(true);
    expect(shippo.test("shippo_live_abc")).toBe(true);
    expect(shippo.test("shippoabc")).toBe(false);
  });
});
