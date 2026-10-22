import { env } from "@sweettreats/env/server";

import { logger } from "../lib/logger";
import type { AdminRealtimeEvent } from "./types";

/**
 * Publish an admin realtime event to the "admins" room.
 *
 * Advisory by design: fire-and-forget at the call sites, never awaited on
 * the critical path, and failures are swallowed — the 20s polling badge is
 * the source of truth and self-heals anything push misses. No-ops when the
 * NOTIFICATIONS binding is absent (bare dev, older deploy).
 */
export function publishAdminEvent(event: AdminRealtimeEvent): void {
  void (async () => {
    try {
      const namespace = (env as Record<string, any>).NOTIFICATIONS;
      if (!namespace) {
        return;
      }
      const id = namespace.idFromName("admins");
      const reached = await namespace.get(id).publish(event);
      if (reached > 0) {
        logger.info("realtime.published", { type: event.type, reached });
      }
    } catch (error) {
      logger.warn("realtime.publish_failed", {
        type: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}
