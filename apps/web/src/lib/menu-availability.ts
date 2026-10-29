/**
 * Per-day menu availability rule shared by the storefront projection and
 * checkout validation.
 *
 * `availableOverride` is the admin's daily-menu switch:
 * - true  → force available even if the item's global flag is off
 * - false → sold out today even if the global flag is on
 * - null  → inherit the item's global `available` flag
 */
export function dailyAvailability(
  override: boolean | null | undefined,
  fallback: boolean,
): boolean {
  return override ?? fallback;
}
