import { getAuth, resolveUserRole } from "../lib/auth-server";

/**
 * Admin gate for the realtime WebSocket upgrade.
 *
 * The /api/realtime route is intercepted in the Worker fetch entry — before
 * the TanStack Start handler — so the normal server-fn request context
 * (getRequestHeaders) isn't available. This authenticates the raw Request
 * directly: better-auth reads the session cookie from these headers, then
 * the database role decides. Fail-closed: any error rejects the upgrade.
 */
export async function isAdminWebRequest(request: Request): Promise<boolean> {
  try {
    const auth = getAuth();
    if (!auth) {
      return false;
    }
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return false;
    }
    const role = await resolveUserRole(session.user.id, session.user.email);
    return role === "admin" || role === "owner";
  } catch {
    return false;
  }
}
