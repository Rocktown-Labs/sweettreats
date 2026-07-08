import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import alchemy from "alchemy/cloudflare/tanstack-start";
import { defineConfig } from "vite-plus";
const alchemyConfigPath = fileURLToPath(
  new URL("./.alchemy/local/wrangler.jsonc", import.meta.url),
);
const isTest =
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true" ||
  process.env.E2E === "true" ||
  process.argv.some((arg) => arg.includes("test"));
const shouldUseAlchemy = existsSync(alchemyConfigPath) && !isTest;
const shouldUseWorkersRuntime = shouldUseAlchemy || process.env.WORKERS_BUILD === "true";
const cloudflareWorkersShimPath = fileURLToPath(
  new URL("./src/utils/cloudflare-browser-shim.ts", import.meta.url),
);

export default defineConfig(() => {
  const cloudflareWorkersAlias = shouldUseWorkersRuntime
    ? {
        "node:fs": fileURLToPath(new URL("./src/utils/worker-fs-stub.ts", import.meta.url)),
        "node:path": fileURLToPath(new URL("./src/utils/worker-path-stub.ts", import.meta.url)),
      }
    : {};

  return {
    server: {
      port: 3001,
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
    resolve: {
      tsconfigPaths: true,
      alias: cloudflareWorkersAlias,
    },
    plugins: [
      {
        name: "sweet-treats-cloudflare-workers-resolver",
        enforce: "pre",
        resolveId(id, _importer, options) {
          if (id !== "cloudflare:workers") {
            return null;
          }

          if (shouldUseWorkersRuntime && options?.ssr) {
            return { id, external: true };
          }

          return cloudflareWorkersShimPath;
        },
      },
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      ...(shouldUseAlchemy ? [alchemy({ configPath: alchemyConfigPath })] : []),
    ],
  };
});
