import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: {
    port: 3001,
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  environments: {
    ssr: {
      build: {
        rolldownOptions: {
          external: ["cloudflare:workers"],
        },
      },
    },
  },
});
