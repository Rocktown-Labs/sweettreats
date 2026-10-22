/**
 * Deployed Worker entry (Alchemy Website.Vite `main`).
 *
 * The framework's server bundle (virtual:tanstack-start-server-entry) only
 * exports `fetch`, so this module re-exports it alongside the extra Workers
 * entry points the scale-hardening build requires:
 * - `queue`     → email outbox consumer
 * - `scheduled` → hourly maintenance cron
 * - `NotificationCenter` → realtime admin badge fan-out (Durable Object)
 *
 * `apps/web/worker.ts` stays as the local `wrangler dev` entry (it imports
 * the pre-built dist bundle instead of the virtual module).
 */
// @ts-expect-error — virtual module provided by the TanStack Start plugin
import handler from "virtual:tanstack-start-server-entry";
import { handleEmailQueue } from "../src/worker/queue";
import { handleScheduled } from "../src/worker/scheduled";
import { NotificationCenter } from "../src/realtime/notification-center";
import { isAdminWebRequest } from "../src/realtime/guard";

export { NotificationCenter };

const REALTIME_PATH = "/api/realtime";

export default {
  fetch: async (request: Request, env: unknown, ctx: unknown): Promise<Response> => {
    // Realtime WebSocket upgrades bypass the SSR handler entirely: verify
    // the admin session, then hand the upgrade to the NotificationCenter DO.
    if (new URL(request.url).pathname === REALTIME_PATH) {
      if (!(await isAdminWebRequest(request))) {
        return new Response("Admin access required", { status: 401 });
      }
      const namespace = (env as Record<string, any>)?.NOTIFICATIONS;
      if (!namespace) {
        return new Response("Realtime unavailable", { status: 503 });
      }
      const id = namespace.idFromName("admins");
      return namespace.get(id).fetch(request);
    }

    return (
      handler as { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> }
    ).fetch(request, env, ctx);
  },
  queue: handleEmailQueue,
  scheduled: handleScheduled,
};
