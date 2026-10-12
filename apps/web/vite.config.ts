import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const cloudflareWorkersShimPath = fileURLToPath(
  new URL("./src/utils/cloudflare-browser-shim.ts", import.meta.url),
);
const fsStubPath = fileURLToPath(new URL("./src/utils/worker-fs-stub.ts", import.meta.url));
const pathStubPath = fileURLToPath(new URL("./src/utils/worker-path-stub.ts", import.meta.url));

export default defineConfig(() => {
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
      alias: [
        { find: /^node:fs\/promises$/, replacement: fsStubPath },
        { find: /^node:fs$/, replacement: fsStubPath },
        { find: /^fs\/promises$/, replacement: fsStubPath },
        { find: /^fs$/, replacement: fsStubPath },
        { find: /^node:path$/, replacement: pathStubPath },
        { find: /^path$/, replacement: pathStubPath },
      ],
    },
    environments: {
      ssr: {
        build: {
          rolldownOptions: {
            external: ["cloudflare:workers"],
          },
        },
      },
    },
    plugins: [
      {
        name: "sweet-treats-cloudflare-workers-resolver",
        enforce: "pre",
        resolveId(id, _importer, options) {
          if (id !== "cloudflare:workers") {
            return null;
          }

          if (options?.ssr) {
            return { id, external: true };
          }

          return cloudflareWorkersShimPath;
        },
      },
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  };
});
