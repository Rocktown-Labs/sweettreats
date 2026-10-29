import { describe, expect, it, vi } from "vitest";

vi.mock("@sweettreats/env/server", () => ({ env: {} }));

import { publicPickupLocation } from "./api";

describe("public pickup location projection", () => {
  it("never serializes the internal notification contact email", () => {
    const location = {
      id: "loc-1",
      name: "Downtown",
      address: "1 Main St",
      instructions: "",
      phone: "555-0100",
      contactEmail: "vendor-private@example.com",
      active: true,
      sortOrder: 0,
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-01-01 00:00:00",
    };
    const publicLocation = publicPickupLocation(location);
    expect(publicLocation).not.toHaveProperty("contactEmail");
    expect(publicLocation.name).toBe("Downtown");
  });
});
