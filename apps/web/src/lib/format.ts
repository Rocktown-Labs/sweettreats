export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function imageUrl(imageKey: string | null | undefined) {
  if (!imageKey) {
    return "/cookie-placeholder.svg";
  }

  if (imageKey.startsWith("/")) {
    return imageKey;
  }

  return `/media/${imageKey}`;
}

export function orderStatusLabel(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
