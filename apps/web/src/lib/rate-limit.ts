import { sql } from "drizzle-orm";
import type { createDb } from "@sweettreats/db";

/**
 * Fixed-window rate limiter backed by D1 — the only cross-isolate store
 * available in this app without new infrastructure.
 *
 * Each check is a single atomic upsert, so concurrent requests can't race
 * past the limit. The time bucket is baked into the key, so rows for old
 * buckets are pruned lazily and cheaply.
 */

export type RateLimitDb = ReturnType<typeof createDb>;

const PRUNE_EVERY = 100;
let checkCount = 0;

export async function rateLimit(
  db: RateLimitDb,
  action: string,
  identifier: string,
  windowSeconds: number,
  limit: number,
): Promise<{ ok: boolean; remaining: number }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const window = Math.floor(nowSeconds / windowSeconds);
  const bucketKey = `${action}:${identifier}:${window}`;
  const windowStart = window * windowSeconds;
  const expiresAtSeconds = windowStart + windowSeconds * 2;

  const result = await db.run(sql`
    INSERT INTO rate_limits (bucket_key, hits, expires_at)
    VALUES (${bucketKey}, 1, ${expiresAtSeconds})
    ON CONFLICT (bucket_key) DO UPDATE SET hits = hits + 1
    RETURNING hits
  `);

  const hits =
    result.results.length > 0
      ? Number((result.results[0] as Record<string, unknown>).hits ?? 0)
      : 1;

  // Occasionally prune expired buckets so the table doesn't grow forever.
  checkCount += 1;
  if (checkCount % PRUNE_EVERY === 0) {
    try {
      await db.run(sql`DELETE FROM rate_limits WHERE expires_at < ${nowSeconds}`);
    } catch {
      // Pruning is best-effort; never fail a request because of it.
    }
  }

  const ok = hits <= limit;
  return { ok, remaining: Math.max(0, limit - hits) };
}

export function clientIpFromHeaders(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
