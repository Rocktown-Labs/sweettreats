/**
 * Pickup scheduling helpers. All "shop time" math happens in the shop's time zone so a
 * customer in another zone (or a server in UTC) can't pick a slot that has already passed.
 */

export const SHOP_TIME_ZONE = "America/Chicago";
export const PICKUP_OPEN_MINUTES = 11 * 60;
export const PICKUP_CLOSE_MINUTES = 23 * 60;
export const PICKUP_STEP_MINUTES = 30;
/** Minimum notice the kitchen needs for same-day orders. */
export const PICKUP_LEAD_MINUTES = 30;
/** How far ahead customers can schedule a pickup. */
export const PICKUP_WINDOW_DAYS = 30;

export type PickupSlot = {
  /** 24h "HH:MM", the format the server stores. */
  value: string;
  /** Friendly "1:30 PM" label. */
  label: string;
  disabled: boolean;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** Parse "YYYY-MM-DD" as a local calendar date (no UTC drift). */
export function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDaysIso(iso: string, days: number) {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function formatPickupDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseIsoDate(iso));
}

export function formatSlotLabel(minutes: number) {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${pad(mins)} ${suffix}`;
}

/** Current date + minutes-since-midnight in the shop's time zone. */
export function shopNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";

  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

/** Today's calendar date in the shop's time zone (YYYY-MM-DD). */
export function shopDateIso(date = new Date()) {
  return shopNow(date).date;
}

/** True when a requested pickup slot is bookable: in range and not in the past. */
export function isPickupSlotBookable(dateIso: string, time: string, now = shopNow()): boolean {
  const slots = pickupSlots(dateIso, now);
  return slots.some((slot) => slot.value === time && !slot.disabled);
}

/** True when the given date still has at least one open bookable slot right now. */
export function hasBookableSlots(dateIso: string, now = shopNow()): boolean {
  return pickupSlots(dateIso, now).some((slot) => !slot.disabled);
}

/** Earliest bookable pickup date: today if any slots are left today, otherwise tomorrow. */
export function earliestBookableDate(now = shopNow()): string {
  return hasBookableSlots(now.date, now) ? now.date : addDaysIso(now.date, 1);
}

export function pickupSlots(dateIso: string, now = shopNow()): PickupSlot[] {
  const slots: PickupSlot[] = [];
  for (
    let minutes = PICKUP_OPEN_MINUTES;
    minutes <= PICKUP_CLOSE_MINUTES;
    minutes += PICKUP_STEP_MINUTES
  ) {
    const isPast =
      dateIso < now.date || (dateIso === now.date && minutes < now.minutes + PICKUP_LEAD_MINUTES);
    slots.push({
      value: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
      label: formatSlotLabel(minutes),
      disabled: isPast,
    });
  }
  return slots;
}
