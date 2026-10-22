/**
 * Resolution stubs for `wrangler dev` only.
 *
 * `wrangler dev` bundles ./worker.ts with its own esbuild pass — no TanStack
 * Start plugin, so the `#tanstack-*` / `tanstack-start-manifest:v` virtual
 * modules that `@tanstack/start-server-core` imports dynamically cannot be
 * resolved (see the "alias" map in wrangler.jsonc). They only execute inside
 * `createStartHandler`'s SSR boot path, which is dead code in this worker:
 * the fetch handler comes from the pre-built ./dist/server/server.js bundle
 * where the vite plugin already resolved those virtuals. Nothing here ever
 * runs; it exists purely so the bundler can resolve the specifiers.
 */
export {};
