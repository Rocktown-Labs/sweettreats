import * as cf from "cloudflare:workers";
import type { CloudflareEnv } from "../env.d.ts";

// For Cloudflare Workers, env is accessed via cloudflare:workers module.
// In dev mode with TanStack Start, we access via Proxy for robust property resolution.
export const env = new Proxy({} as CloudflareEnv, {
  get(_target, prop: string) {
    return (cf.env as any)?.[prop];
  },
});
