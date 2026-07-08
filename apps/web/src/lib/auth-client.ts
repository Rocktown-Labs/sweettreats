import { createAuthClient } from "better-auth/react";
import { stripeClient } from "@better-auth/stripe/client";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (globalThis as any).process?.env?.BETTER_AUTH_URL ||
        "https://sweettreats.rocktown-labs.workers.dev",
  plugins: [stripeClient()],
});
