import { describe, expect, test } from "vitest";
import {
  earliestBookableDate,
  hasBookableSlots,
  isPickupSlotBookable,
  pickupSlots,
} from "./pickup";

describe("pickup scheduling and closing cutoff", () => {
  const today = "2026-10-21";
  const tomorrow = "2026-10-22";

  test("generates slots from 11:00 AM to 11:00 PM", () => {
    // Simulated morning time (9:00 AM CST)
    const morning = { date: today, minutes: 9 * 60 };
    const slots = pickupSlots(today, morning);

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.value).toBe("11:00");
    expect(slots[slots.length - 1]?.value).toBe("23:00");
    expect(slots[0]?.disabled).toBe(false);
    expect(hasBookableSlots(today, morning)).toBe(true);
    expect(earliestBookableDate(morning)).toBe(today);
  });

  test("requires 30-minute lead time for same-day slots", () => {
    // 1:15 PM CST (13 * 60 + 15 = 795 minutes)
    // Next eligible slot must be >= 1:45 PM (825 min) -> 2:00 PM (840 min)
    const afternoon = { date: today, minutes: 13 * 60 + 15 };
    const slots = pickupSlots(today, afternoon);

    const slot1pm = slots.find((s) => s.value === "13:00");
    const slot130pm = slots.find((s) => s.value === "13:30");
    const slot2pm = slots.find((s) => s.value === "14:00");

    expect(slot1pm?.disabled).toBe(true);
    expect(slot130pm?.disabled).toBe(true);
    expect(slot2pm?.disabled).toBe(false);
  });

  test("allows the 11:00 PM slot up until 10:30 PM CST", () => {
    // Exactly 10:30 PM CST (22 * 60 + 30 = 1350 minutes)
    // 11:00 PM is 23 * 60 = 1380 minutes. 1350 + 30 <= 1380, so 11:00 PM is available.
    const cutoffEdge = { date: today, minutes: 22 * 60 + 30 };
    const slots = pickupSlots(today, cutoffEdge);

    const lastSlot = slots.find((s) => s.value === "23:00");
    expect(lastSlot?.disabled).toBe(false);
    expect(hasBookableSlots(today, cutoffEdge)).toBe(true);
    expect(earliestBookableDate(cutoffEdge)).toBe(today);
  });

  test("closes same-day ordering 30 mins before closing (past 10:30 PM CST)", () => {
    // 10:31 PM CST (1351 minutes)
    const pastCutoff = { date: today, minutes: 22 * 60 + 31 };
    const slots = pickupSlots(today, pastCutoff);

    // All slots for today are disabled
    expect(slots.every((s) => s.disabled)).toBe(true);
    expect(hasBookableSlots(today, pastCutoff)).toBe(false);

    // Earliest bookable pickup date automatically rolls over to tomorrow
    expect(earliestBookableDate(pastCutoff)).toBe(tomorrow);

    // Same-day slot is not bookable
    expect(isPickupSlotBookable(today, "23:00", pastCutoff)).toBe(false);
  });

  test("preordering for tomorrow is open even after today's same-day cutoff", () => {
    // It is 11:15 PM CST at night; today is closed
    const lateNight = { date: today, minutes: 23 * 60 + 15 };

    // Today is closed
    expect(hasBookableSlots(today, lateNight)).toBe(false);

    // Tomorrow is open
    expect(hasBookableSlots(tomorrow, lateNight)).toBe(true);
    expect(isPickupSlotBookable(tomorrow, "11:00", lateNight)).toBe(true);
    expect(isPickupSlotBookable(tomorrow, "14:30", lateNight)).toBe(true);
  });
});
