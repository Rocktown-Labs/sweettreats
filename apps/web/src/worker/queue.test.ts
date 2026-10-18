import { describe, expect, it, vi } from "vitest";

/**
 * The queue consumer's contract: a message that references a missing or
 * already-sent outbox row is acked without sending; an unknown event warns
 * without failing the row; a genuine send failure marks the row for retry.
 */

const firstOutbox = vi.fn();
const handleEvent = vi.fn();

vi.mock("@sweettreats/db", () => ({
  createDb: () => ({
    query: {
      emailOutbox: { findFirst: firstOutbox },
    },
  }),
}));

vi.mock("../lib/email-events", () => ({
  handleOutboxEvent: (...args: unknown[]) => handleEvent(...args),
}));

vi.mock("../lib/outbox", () => ({
  markOutboxSent: vi.fn(async () => {}),
  markOutboxRetry: vi.fn(async () => {}),
  markOutboxFailed: vi.fn(async () => {}),
  reenqueueStaleOutboxRows: vi.fn(async () => 0),
  queueSend: vi.fn(async () => {}),
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@sweettreats/env/server", () => ({ env: {} }));

type FakeMessage = {
  body: string;
  attempts: number;
  acked: () => void;
  retried: () => void;
  ack: () => void;
  retry: () => void;
};

function message(body: unknown, attempts = 0): FakeMessage {
  return {
    body: JSON.stringify(body),
    attempts,
    acked: vi.fn() as unknown as () => void,
    retried: vi.fn() as unknown as () => void,
    ack: () => {},
    retry: () => {},
  } as FakeMessage;
}

describe("email queue consumer", () => {
  it("acks messages with no outbox id", async () => {
    const { handleEmailQueue } = await import("./queue");
    const msg = message({ nope: true });
    msg.ack = () => (msg.acked = vi.fn() as unknown as () => void);
    let acked = false;
    (msg as { ack: () => void }).ack = () => {
      acked = true;
    };
    await handleEmailQueue({ messages: [msg as never] }, {});
    expect(acked).toBe(true);
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it("acks missing outbox rows without dispatching", async () => {
    firstOutbox.mockResolvedValueOnce(null);
    const { handleEmailQueue } = await import("./queue");
    const msg = message({ outboxId: "gone" });
    let acked = false;
    msg.ack = () => {
      acked = true;
    };
    await handleEmailQueue({ messages: [msg as never] }, {});
    expect(acked).toBe(true);
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it("replays already-sent rows idempotently (ack, no dispatch)", async () => {
    firstOutbox.mockResolvedValueOnce({
      id: "sent-row",
      event: "order.confirmed",
      payload: '{"orderId":"o1"}',
      status: "sent",
      attempts: 0,
    });
    const { handleEmailQueue } = await import("./queue");
    const msg = message({ outboxId: "sent-row" });
    let acked = false;
    msg.ack = () => {
      acked = true;
    };
    await handleEmailQueue({ messages: [msg as never] }, {});
    expect(acked).toBe(true);
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it("dispatches pending rows by event and acks on success", async () => {
    firstOutbox.mockResolvedValueOnce({
      id: "pending-row",
      event: "welcome",
      payload: '{"userId":"u1"}',
      status: "pending",
      attempts: 0,
    });
    handleEvent.mockResolvedValueOnce(undefined);
    const { handleEmailQueue } = await import("./queue");
    const msg = message({ outboxId: "pending-row" });
    let acked = false;
    msg.ack = () => {
      acked = true;
    };
    await handleEmailQueue({ messages: [msg as never] }, {});
    expect(handleEvent).toHaveBeenCalledWith("welcome", { userId: "u1" });
    expect(acked).toBe(true);
  });

  it("retries rows whose dispatch throws (first queue attempt)", async () => {
    firstOutbox.mockResolvedValueOnce({
      id: "failing-row",
      event: "order.confirmed",
      payload: '{"orderId":"o2"}',
      status: "pending",
      attempts: 0,
    });
    handleEvent.mockRejectedValueOnce(new Error("resend down"));
    const { handleEmailQueue } = await import("./queue");
    const msg = message({ outboxId: "failing-row" });
    let retried = false;
    msg.retry = () => {
      retried = true;
    };
    await handleEmailQueue({ messages: [msg as never] }, {});
    expect(retried).toBe(true);
  });
});
