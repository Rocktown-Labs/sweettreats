import { DurableObject } from "cloudflare:workers";

import type { AdminRealtimeEvent } from "./types";

/**
 * Realtime fan-out for the admin badge system.
 *
 * One DO instance per room, addressed by name. Every connected admin browser
 * holds a WebSocket open here; publish() broadcasts an event to all of them.
 * Sockets use the hibernation API, so the DO costs nothing while idle — the
 * bakery's tabs can stay open all day.
 *
 * Rooms: today the worker routes every authenticated admin to the "admins"
 * room. The future vendor feature routes location staff to "location:<id>"
 * rooms the same way — the publish call just needs a room parameter.
 */
export class NotificationCenter extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    // Admin-only: the Worker's fetch entry verifies the session before the
    // request ever reaches this object. Defense in depth — reject anything
    // that arrives unauthenticated through some other path.
    const pair = new WebSocketPair();
    // Hibernation API: memory is freed between messages; sockets stay open.
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /**
   * Broadcast an event to every connected admin tab. Called over RPC from
   * anywhere in the Worker (createOrder, the Stripe webhook, admin actions).
   * Returns the number of tabs reached so callers can log reach.
   */
  async publish(event: AdminRealtimeEvent): Promise<number> {
    const sockets = this.ctx.getWebSockets();
    const message = JSON.stringify(event);
    for (const socket of sockets) {
      try {
        socket.send(message);
      } catch {
        // A dead socket is pruned by the runtime; skip it.
      }
    }
    return sockets.length;
  }
}
