import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { env } from "@sweettreats/env/server";

export const getAuthRuntimeConfig = createServerFn({ method: "GET" }).handler(async () => ({
  clerkConfigured: false,
  betterAuthConfigured: true,
  adminEmails: String(env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
}));

export const requireSignedIn = createServerFn({ method: "GET" })
  .validator((redirectTo: string) => redirectTo)
  .handler(async ({ data: redirectTo }) => {
    const headers = getRequestHeaders();
    const { getAuth } = await import("./auth-server");
    const session = await getAuth().api.getSession({ headers });

    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: redirectTo },
      });
    }

    return { userId: session.user.id };
  });
