import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";

/**
 * Public runtime config for the root loader. Deliberately contains no admin
 * identity information — the admin roster must never ship to the browser.
 */
export const getAuthRuntimeConfig = createServerFn({ method: "GET" }).handler(async () => ({
  betterAuthConfigured: true,
}));

/**
 * Session-aware admin check for UI gating. Returns a boolean only, so the
 * admin email list can never leak to the client.
 */
export const isCurrentUserAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { isCurrentUserAdmin: check } = await import("./auth-server");
  return check();
});

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
