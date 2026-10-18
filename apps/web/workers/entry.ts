/**
 * Deployed Worker entry (Alchemy Website.Vite `main`).
 *
 * The framework's server bundle (virtual:tanstack-start-server-entry) only
 * exports `fetch`, so this module re-exports it alongside the extra Workers
 * entry points the scale-hardening build requires:
 * - `queue`    → email outbox consumer
 * - `scheduled`→ hourly maintenance cron
 *
 * `apps/web/worker.ts` stays as the local `wrangler dev` entry (it imports
 * the pre-built dist bundle instead of the virtual module).
 */
// @ts-expect-error — virtual module provided by the TanStack Start plugin
import handler from "virtual:tanstack-start-server-entry";
import { handleEmailQueue } from "../src/worker/queue";
import { handleScheduled } from "../src/worker/scheduled";

export default {
  fetch: (request: Request, env: unknown, ctx: unknown) =>
    (
      handler as { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> }
    ).fetch(request, env, ctx),
  queue: handleEmailQueue,
  scheduled: handleScheduled,
};
