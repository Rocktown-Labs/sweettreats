import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMagicLinkEmail } from "@sweettreats/email";

/**
 * Regression: when RESEND_API_KEY is absent (preview/dev), the email helpers
 * fall back to logging. They must never log the recipient address or the
 * magic-link URL — that URL contains a one-time sign-in token.
 */

let savedResendKey: string | undefined;

beforeEach(() => {
  savedResendKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  if (savedResendKey === undefined) {
    delete process.env.RESEND_API_KEY;
  } else {
    process.env.RESEND_API_KEY = savedResendKey;
  }
  vi.restoreAllMocks();
});

describe("email fallback logging", () => {
  it("does not log magic-link tokens or recipient addresses", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await sendMagicLinkEmail(
      {
        url: "https://sweet.test/api/auth/magic-link/verify?token=super-secret-token",
        email: "victim@example.com",
      },
      { to: "victim@example.com", apiKey: "" },
    );

    const logged = info.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).toContain("email.magic_link_simulated");
    expect(logged).not.toContain("super-secret-token");
    expect(logged).not.toContain("victim@example.com");
  });
});
