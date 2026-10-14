import { describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));

vi.mock("@sweettreats/env/server", () => ({
  env: envMock.env,
}));

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { computeShipmentWeight, type ShippableItemLite } from "./shipping";
import { parseReservationSnapshot } from "./inventory";

function item(overrides: Partial<ShippableItemLite> & { id?: string }): ShippableItemLite {
  return {
    id: overrides.id ?? "item-1",
    name: overrides.name ?? "Cookie",
    isShippable: overrides.isShippable ?? true,
    weightOunces: overrides.weightOunces ?? 0,
    weightMaxOunces: overrides.weightMaxOunces ?? null,
    packSize: overrides.packSize ?? null,
    packTareOunces: overrides.packTareOunces ?? 0,
    priceCents: overrides.priceCents ?? 350,
  };
}

describe("computeShipmentWeight", () => {
  it("sums single-item weights and rounds up", () => {
    const result = computeShipmentWeight(
      [{ item: item({ id: "a", name: "Choc chip", weightOunces: 2.5 }), quantity: 3 }],
      new Map(),
    );
    expect(result.totalOunces).toBe(8); // 2.5 * 3 = 7.5 → rounds up
  });

  it("uses the max weight when set so quotes never undercharge", () => {
    const result = computeShipmentWeight(
      [
        {
          item: item({ id: "a", name: "Choc chip", weightOunces: 2, weightMaxOunces: 3 }),
          quantity: 2,
        },
      ],
      new Map(),
    );
    expect(result.totalOunces).toBe(6);
  });

  it("expands packs into contents plus tare", () => {
    const pack = item({ id: "pack", name: "6-pack", packSize: 6, packTareOunces: 4 });
    const choc = item({ id: "choc", name: "Choc chip", weightOunces: 2 });
    const straw = item({ id: "straw", name: "Strawberry", weightOunces: 2.5 });
    const contents = new Map([
      [
        "pack",
        [
          { cookieItemId: "choc", quantity: 3, cookie: choc },
          { cookieItemId: "straw", quantity: 3, cookie: straw },
        ],
      ],
    ]);
    // (3*2 + 3*2.5 + 4 tare) * 2 packs = 35
    const result = computeShipmentWeight([{ item: pack, quantity: 2 }], contents);
    expect(result.totalOunces).toBe(35);
  });

  it("flags unshippable items instead of quoting them", () => {
    const result = computeShipmentWeight(
      [{ item: item({ id: "cake", name: "Cake", isShippable: false }), quantity: 1 }],
      new Map(),
    );
    expect(result.unshippableNames).toEqual(["Cake"]);
    expect(result.totalOunces).toBe(0);
  });

  it("flags items with no weight and packs with no contents", () => {
    const result = computeShipmentWeight(
      [
        { item: item({ id: "noweight", name: "No weight" }), quantity: 1 },
        { item: item({ id: "emptypack", name: "Empty pack", packSize: 6 }), quantity: 1 },
      ],
      new Map(),
    );
    expect(result.missingWeightNames).toEqual(["No weight"]);
    expect(result.emptyPackNames).toEqual(["Empty pack"]);
  });

  it("uses a manually weighted pack when it has no contents", () => {
    const result = computeShipmentWeight(
      [
        {
          item: item({
            id: "manualpack",
            name: "Manual pack",
            packSize: 6,
            packTareOunces: 4,
            weightOunces: 20,
          }),
          quantity: 1,
        },
      ],
      new Map(),
    );
    expect(result.totalOunces).toBe(24); // 20 manual + 4 tare
  });
});

describe("parseReservationSnapshot (release path)", () => {
  it("parses per-line snapshots", () => {
    expect(parseReservationSnapshot('[{"menuItemId":"choc","quantity":3}]')).toEqual([
      { menuItemId: "choc", quantity: 3 },
    ]);
    expect(
      parseReservationSnapshot(
        '[{"menuItemId":"choc","quantity":3},{"menuItemId":"velvet","quantity":2}]',
      ),
    ).toEqual([
      { menuItemId: "choc", quantity: 3 },
      { menuItemId: "velvet", quantity: 2 },
    ]);
  });

  it("returns null for missing or malformed snapshots; empty arrays stay empty", () => {
    expect(parseReservationSnapshot(null)).toBeNull();
    expect(parseReservationSnapshot("not json")).toBeNull();
    expect(parseReservationSnapshot('{"weird":true}')).toBeNull();
    // An empty snapshot means "nothing was reserved" — valid, releases nothing.
    expect(parseReservationSnapshot("[]")).toEqual([]);
  });
});
