import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";
import { D1Database } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("sweettreats");

const db = await D1Database("database", {
  migrationsDir: "../../packages/db/src/migrations",
});

export const web = await TanStackStart("web", {
  cwd: "../../apps/web",
  bindings: {
    DB: db,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    CLERK_SECRET_KEY: alchemy.secret.env.CLERK_SECRET_KEY!,
  },
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
