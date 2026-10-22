import handler from "./dist/server/server.js";
import { handleEmailQueue } from "./src/worker/queue";
import { handleScheduled } from "./src/worker/scheduled";
import { NotificationCenter } from "./src/realtime/notification-center";
import { isAdminWebRequest } from "./src/realtime/guard";

// Local `wrangler dev` entry: same shape as the deployed workers/entry.ts,
// but the TanStack handler comes from the pre-built dist bundle. See
// workers/tanstack-stubs.js for why the raw imports resolve here.
export { NotificationCenter };

const REALTIME_PATH = "/api/realtime";

export default {
  fetch: async (request: Request, env: unknown, ctx: unknown): Promise<Response> => {
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
