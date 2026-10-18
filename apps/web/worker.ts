import handler from "./dist/server/server.js";
import { handleEmailQueue } from "./src/worker/queue";
import { handleScheduled } from "./src/worker/scheduled";

export default {
  fetch: (request: Request, env: unknown, ctx: unknown) =>
    // The TanStack Start handler is an object with a fetch method; preserve
    // its dynamic binding when delegating.
    (
      handler as { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> }
    ).fetch(request, env, ctx),
  queue: handleEmailQueue,
  scheduled: handleScheduled,
};
