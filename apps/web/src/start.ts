import { createMiddleware, createStart } from "@tanstack/react-start";

/**
 * Conservative content security policy. Scripts/styles need 'unsafe-inline'
 * because TanStack Start inlines the hydration payload and the app uses
 * inline style attributes; external script loading stays blocked, which is
 * the meaningful XSS mitigation. Nonce-based script-src is future work.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://traks-collect.rocktown-labs.workers.dev",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://traks-collect.rocktown-labs.workers.dev",
  "form-action 'self' https://checkout.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const securityHeaders = createMiddleware({ type: "request" }).server(async ({ request, next }) => {
  const result = await next();
  const headers = new Headers(result.response.headers);
  const contentType = headers.get("content-type") || "";

  if (!headers.has("x-content-type-options")) {
    headers.set("x-content-type-options", "nosniff");
  }
  if (!headers.has("referrer-policy")) {
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
  }
  if (!headers.has("x-frame-options")) {
    headers.set("x-frame-options", "DENY");
  }
  if (contentType.includes("text/html")) {
    if (!headers.has("content-security-policy")) {
      headers.set("content-security-policy", CSP);
    }
    if (request.url.startsWith("https:") && !headers.has("strict-transport-security")) {
      headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    }
  }

  const response = new Response(result.response.body, {
    status: result.response.status,
    statusText: result.response.statusText,
    headers,
  });
  return { ...result, response };
});

const CACHEABLE_PATH_PREFIXES = ["/menu", "/item/"];

/**
 * Anonymous HTML edge-cache for the storefront. Only cacheable for visitors
 * without a session cookie, only for GET page renders (not server functions),
 * and only for a short TTL so menu changes show up quickly.
 */
const pageCache = createMiddleware({ type: "request" }).server(async ({ request, next }) => {
  if (typeof caches === "undefined") {
    return next();
  }
  if (request.method !== "GET") {
    return next();
  }

  const url = new URL(request.url);
  const isCacheablePath =
    url.pathname === "/" ||
    CACHEABLE_PATH_PREFIXES.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(prefix),
    );
  if (!isCacheablePath) {
    return next();
  }

  // Never serve personalized HTML from cache: skip entirely when any auth
  // cookie is present rather than varying on every cookie value.
  const cookieHeader = request.headers.get("cookie") || "";
  if (cookieHeader.includes("better-auth")) {
    return next();
  }

  const cache =
    typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : undefined;
  if (!cache) {
    return next();
  }
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const result = await next();
  if (result.response.status !== 200) {
    return result;
  }

  // Only cache what a browser renders as a document — never JSON/RPC
  // payloads that happen to share the URL.
  const acceptHeader = request.headers.get("accept") || "";
  const contentType = result.response.headers.get("content-type") || "";
  if (!acceptHeader.includes("text/html") || !contentType.includes("text/html")) {
    return result;
  }

  // The Cache API refuses responses carrying Set-Cookie; strip it (we only
  // cache anonymous pages anyway) and stamp a short TTL.
  const headers = new Headers(result.response.headers);
  headers.delete("set-cookie");
  headers.set("cache-control", "public, s-maxage=60, stale-while-revalidate=300");

  try {
    const forCache = result.response.clone();
    await cache.put(request, new Response(forCache.body, { headers }));
  } catch {
    // Cache failures must never break the page.
  }

  return result;
});

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [pageCache, securityHeaders],
  };
});
