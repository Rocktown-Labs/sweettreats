import { describe, expect, it } from "vitest";

import { dailyAvailability } from "./menu-availability";

describe("daily menu availability", () => {
  it("inherits the global flag when there is no override", () => {
    expect(dailyAvailability(null, true)).toBe(true);
    expect(dailyAvailability(null, false)).toBe(false);
    expect(dailyAvailability(undefined, true)).toBe(true);
  });

  it("lets an admin force an item available for one day", () => {
    expect(dailyAvailability(true, false)).toBe(true);
  });

  it("lets an admin mark an item sold out for one day", () => {
    expect(dailyAvailability(false, true)).toBe(false);
  });
});
