import { createAuthClient } from "better-auth/react";
import { stripeClient } from "@better-auth/stripe/client";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (globalThis as any).process?.env?.BETTER_AUTH_URL || "https://sweettreatslr.com",
  plugins: [stripeClient(), magicLinkClient()],
});
