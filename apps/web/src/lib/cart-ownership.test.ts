import { describe, expect, it, vi } from "vitest";

vi.mock("@sweettreats/env/server", () => ({ env: {} }));

import { canMutateCartSnapshot } from "./api";

function dbWith(row: { userId: string | null; email: string } | null) {
  return {
    query: {
      cartSnapshots: {
        findFirst: async () => row,
      },
    },
  } as never;
}

describe("cart snapshot ownership", () => {
  it("allows a new cart id", async () => {
    expect(await canMutateCartSnapshot(dbWith(null), "cart-1", null, null)).toBe(true);
  });

  it("blocks a different signed-in user", async () => {
    const db = dbWith({ userId: "user-1", email: "one@example.com" });
    expect(await canMutateCartSnapshot(db, "cart-1", "user-2", "one@example.com")).toBe(false);
  });

  it("blocks a different email", async () => {
    const db = dbWith({ userId: null, email: "one@example.com" });
    expect(await canMutateCartSnapshot(db, "cart-1", null, "two@example.com")).toBe(false);
    expect(await canMutateCartSnapshot(db, "cart-1", null, null)).toBe(false);
  });

  it("allows the same owner", async () => {
    const db = dbWith({ userId: "user-1", email: "one@example.com" });
    expect(await canMutateCartSnapshot(db, "cart-1", "user-1", "one@example.com")).toBe(true);
  });
});
