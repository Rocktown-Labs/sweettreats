import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { authClient } from "./auth-client";
import { getAdminNotifications } from "./api";
import type { AdminRealtimeEvent } from "../realtime/types";

/**
 * Admin badge system: "N new orders" on the Orders nav item, a toast + ding
 * the moment one lands, and the browser tab title carrying the count.
 *
 * Two delivery layers, one count:
 * - Polling (every 20s, visible tabs only) is the source of truth — it
 *   re-syncs after sleeps, reconnects, and missed pushes.
 * - The /api/realtime WebSocket (NotificationCenter DO) makes it instant:
 *   a push bumps the count optimistically, toasts, and dings.
 *
 * "Seen" is a per-device cursor in localStorage (SQLite timestamp format,
 * matching orders.created_at), advanced when the Orders page is visited —
 * the first run anchors the cursor so order history never badges.
 */

const SEEN_KEY_PREFIX = "stlr-admin-orders-seen:";
const POLL_INTERVAL_MS = 20_000;

/** Window event broadcast for every realtime message the admin receives. */
export const REALTIME_EVENT = "st-realtime";
/** Window event the Orders page dispatches to zero the badge. */
export const ORDERS_SEEN_EVENT = "st-orders-seen";

function sqliteNowUtc(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function readCursor(email: string): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY_PREFIX + email);
  } catch {
    return null;
  }
}

function writeCursor(email: string, at: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY_PREFIX + email, at);
  } catch {
    // Private mode etc. — badges just reset each visit.
  }
}

/** The cursor value captured before the Orders page marks itself seen. */
export function lastSeenOrdersCursor(email: string | undefined): string | null {
  if (!email) {
    return null;
  }
  return readCursor(email.toLowerCase());
}

/** Call from the Orders page (mount, or while watching a live push). */
export function markOrdersSeen(): void {
  window.dispatchEvent(new CustomEvent(ORDERS_SEEN_EVENT));
}

function playDing(): void {
  try {
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }
    const audio = new AudioContextCtor();
    let at = audio.currentTime;
    for (const frequency of [880, 1174.66]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.4);
      at += 0.18;
    }
    window.setTimeout(() => void audio.close().catch(() => {}), 1_200);
  } catch {
    // Autoplay policy or missing API — the toast still fires.
  }
}

function isOnOrdersPage(): boolean {
  const path = window.location.pathname;
  return path === "/admin/orders" || path.startsWith("/admin/orders/");
}

export function useAdminNotifications(): { newOrderCount: number } {
  const { data: session } = authClient.useSession();
  const email = session?.user?.email?.toLowerCase();
  const fetchNotifications = useServerFn(getAdminNotifications);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const countRef = useRef(0);
  const cursorRef = useRef<string | null>(null);
  const baseTitleRef = useRef<string | null>(null);

  const applyCount = useCallback((count: number) => {
    countRef.current = count;
    setNewOrderCount(count);
    if (count > 0) {
      if (baseTitleRef.current === null) {
        baseTitleRef.current = document.title;
      }
      document.title = `(${count}) ${baseTitleRef.current}`;
    } else if (baseTitleRef.current !== null) {
      document.title = baseTitleRef.current;
      baseTitleRef.current = null;
    }
  }, []);

  // ── Polling: the source of truth ─────────────────────────────────────
  const refresh = useCallback(
    async (announce: boolean) => {
      if (!email) {
        return;
      }
      const since = cursorRef.current ?? undefined;
      const result = await fetchNotifications({ data: { since } }).catch(() => null);
      if (!result) {
        return;
      }
      if (!cursorRef.current) {
        // First run on this device: anchor the cursor to now instead of
        // badging the entire order history.
        cursorRef.current = result.now;
        writeCursor(email, result.now);
        applyCount(0);
        return;
      }
      if (announce && result.count > countRef.current) {
        toast.success(`New order ${result.latestOrderNumber} just came in 🍪`);
        playDing();
      }
      applyCount(result.count);
    },
    [email, fetchNotifications, applyCount],
  );

  useEffect(() => {
    if (!email) {
      return;
    }
    cursorRef.current = readCursor(email);
    void refresh(false);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh(true);
      }
    }, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [email, refresh]);

  // ── Instant push: the realtime WebSocket ──────────────────────────────
  useEffect(() => {
    if (!email) {
      return;
    }
    let socket: WebSocket | null = null;
    let closedByUs = false;
    let attempt = 0;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/realtime`);
      socket.onopen = () => {
        attempt = 0;
      };
      socket.onmessage = (message: MessageEvent) => {
        let event: AdminRealtimeEvent;
        try {
          event = JSON.parse(String(message.data)) as AdminRealtimeEvent;
        } catch {
          return;
        }
        // Pages (e.g. Orders) can react to realtime events themselves.
        window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail: event }));

        if (event.type === "order.new") {
          toast.success(`New order ${event.orderNumber} just came in 🍪`);
          playDing();
          if (isOnOrdersPage()) {
            // She's watching the list — the visit itself marks it seen.
            markOrdersSeen();
          } else {
            applyCount(countRef.current + 1);
          }
        }
      };
      socket.onclose = () => {
        if (closedByUs) {
          return;
        }
        // Exponential backoff; polling covers the gap while disconnected.
        attempt += 1;
        reconnectTimer = window.setTimeout(connect, Math.min(1_000 * 2 ** attempt, 30_000));
      };
    };

    connect();
    return () => {
      closedByUs = true;
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [email, applyCount]);

  // ── Zero the badge when the Orders page reports itself seen ─────────
  useEffect(() => {
    const onSeen = () => {
      if (email) {
        const now = sqliteNowUtc();
        cursorRef.current = now;
        writeCursor(email, now);
        applyCount(0);
      }
    };
    window.addEventListener(ORDERS_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(ORDERS_SEEN_EVENT, onSeen);
  }, [email, applyCount]);

  return { newOrderCount };
}
