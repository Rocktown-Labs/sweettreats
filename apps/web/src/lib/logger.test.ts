import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("pino/browser", () => ({
  default: vi.fn(() => mocks),
}));

describe("logger", () => {
  it("writes structured pino events while preserving existing call shape", async () => {
    const { logger } = await import("./logger");

    logger.info("order.created", { orderId: "order_123", subtotalCents: 1200 });
    logger.warn("admin.access_denied", { email: "user@example.com" });
    logger.error("stripe.sync_failed", { error: "No API key" });

    expect(mocks.info).toHaveBeenCalledWith({
      event: "order.created",
      orderId: "order_123",
      subtotalCents: 1200,
    });
    expect(mocks.warn).toHaveBeenCalledWith({
      email: "user@example.com",
      event: "admin.access_denied",
    });
    expect(mocks.error).toHaveBeenCalledWith({
      error: "No API key",
      event: "stripe.sync_failed",
    });
  });
});
