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

/**
 * Routing decision for the /admin tree's beforeLoad. Three visitors, three
 * experiences:
 * - admin           → proceed
 * - expired session → a leftover session cookie with no valid session means
 *                     a returning admin whose sign-in lapsed — send them to
 *                     sign-in instead of a dead end
 * - everyone else   → 404: anonymous visitors and signed-in non-admins see
 *                     the same not-found as any nonexistent page
 *
 * Returns a decision word only — no identity info ships to the client.
 */
export const resolveAdminRouteAccess = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const { getAuth, isCurrentUserAdmin: check } = await import("./auth-server");

  if (await check()) {
    return { access: "admin" as const };
  }

  const hasSessionCookie = (headers.get("cookie") ?? "").includes("better-auth.session");
  if (hasSessionCookie) {
    const session = await getAuth()
      .api.getSession({ headers })
      .catch(() => null);
    if (!session) {
      return { access: "sign-in" as const };
    }
  }

  return { access: "not-found" as const };
});
