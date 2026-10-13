import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));

vi.mock("@sweettreats/env/server", () => ({
  env: envMock.env,
}));

describe("order-token", () => {
  beforeEach(() => {
    envMock.env = { BETTER_AUTH_SECRET: "test-secret-for-hmac-order-tokens-32" };
  });

  it("round-trips a token for its own order id", async () => {
    const { createOrderToken, verifyOrderToken } = await import("./order-token");
    const token = await createOrderToken("order-1");
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(await verifyOrderToken("order-1", token)).toBe(true);
  });

  it("rejects a token minted for a different order", async () => {
    const { createOrderToken, verifyOrderToken } = await import("./order-token");
    const token = await createOrderToken("order-1");
    expect(await verifyOrderToken("order-2", token)).toBe(false);
  });

  it("rejects missing tokens when a secret is configured", async () => {
    const { verifyOrderToken } = await import("./order-token");
    expect(await verifyOrderToken("order-1", undefined)).toBe(false);
    expect(await verifyOrderToken("order-1", "")).toBe(false);
  });

  it("is tamper-sensitive", async () => {
    const { createOrderToken, verifyOrderToken } = await import("./order-token");
    const token = await createOrderToken("order-1");
    const tampered = token.slice(0, 30) + (token.endsWith("00") ? "11" : "00");
    expect(await verifyOrderToken("order-1", tampered)).toBe(false);
  });

  it("fails closed when no secret is configured", async () => {
    envMock.env = {};
    const { verifyOrderToken } = await import("./order-token");
    expect(await verifyOrderToken("order-1", "anything")).toBe(false);
    expect(await verifyOrderToken("order-1", undefined)).toBe(false);
  });
});

describe("rate-limit", () => {
  type Row = { hits: number };

  function mockDb(behavior?: { emptyRowsAt?: Set<string> }) {
    const rows: Map<string, Row> = new Map();
    const db = {
      run: async (query: unknown) => {
        // Drizzle SQL objects expose queryChunks; interpolated string/number
        // values sit in the chunks array as raw primitives. The first one is
        // the bucket key in our upsert.
        const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
        const params = chunks.filter(
          (chunk) => typeof chunk === "string" || typeof chunk === "number",
        );
        const bucketKey = String(params[0] ?? "unknown");
        const existing = rows.get(bucketKey);
        const hits = (existing?.hits ?? 0) + 1;
        rows.set(bucketKey, { hits });
        if (behavior?.emptyRowsAt?.has(bucketKey)) {
          return { results: [] as Row[] };
        }
        return { results: [{ hits }] as Row[] };
      },
    };
    return { db, rows };
  }

  it("allows hits up to the limit and blocks past it", async () => {
    const { rateLimit } = await import("./rate-limit");
    const { db } = mockDb();
    const first = await rateLimit(db as never, "create-order", "ip-1", 600, 3);
    expect(first.ok).toBe(true);
    const second = await rateLimit(db as never, "create-order", "ip-1", 600, 3);
    expect(second.ok).toBe(true);
    const third = await rateLimit(db as never, "create-order", "ip-1", 600, 3);
    expect(third.ok).toBe(true);
    const fourth = await rateLimit(db as never, "create-order", "ip-1", 600, 3);
    expect(fourth.ok).toBe(false);
  });

  it("separates identifiers into independent buckets", async () => {
    const { rateLimit } = await import("./rate-limit");
    const { db } = mockDb();
    const a = await rateLimit(db as never, "create-order", "ip-a", 600, 1);
    const b = await rateLimit(db as never, "create-order", "ip-b", 600, 1);
    const a2 = await rateLimit(db as never, "create-order", "ip-a", 600, 1);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a2.ok).toBe(false);
  });

  it("separates time windows into independent buckets", async () => {
    const { rateLimit } = await import("./rate-limit");
    const { db } = mockDb();
    const windowA = await rateLimit(db as never, "create-order", "ip-a", 600, 1);
    // Same identifier but a much larger window lands in a different bucket.
    const windowB = await rateLimit(db as never, "create-order", "ip-a", 3600, 1);
    expect(windowA.ok).toBe(true);
    expect(windowB.ok).toBe(true);
  });

  it("treats a missing RETURNING row as a single hit rather than blocking", async () => {
    const { rateLimit } = await import("./rate-limit");
    const { db } = mockDb({ emptyRowsAt: new Set(["create-order:ip-x:0"]) });
    const result = await rateLimit(db as never, "create-order", "ip-x", 600, 5);
    expect(result.ok).toBe(true);
  });
});
