import alchemy from "alchemy";
import { readFileSync } from "node:fs";
import { D1Database, R2Bucket, R2Object, TanStackStart } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

await main();

async function main() {
  const app = await alchemy("sweettreats");
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  const corsOrigin = process.env.CORS_ORIGIN ?? "https://sweettreats.rocktown-labs.workers.dev";
  const clerkSecretKey = process.env.CLERK_SECRET_KEY ?? "";
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? "";
  const betterAuthSecret = process.env.BETTER_AUTH_SECRET ?? "";
  const betterAuthUrl = process.env.BETTER_AUTH_URL ?? "";
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "";
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";

  const db = await D1Database("database", {
    name: "sweettreats-db",
    migrationsDir: "../db/src/migrations",
  });

  const media = await R2Bucket("media", {
    name: "sweettreats-media",
  });

  const productPhotos = [
    ["chocolate-chip", "products/chocolate-chip-cookie.png"],
    ["snickerdoodle", "products/snickerdoodle-cookie.png"],
    ["red-velvet", "products/red-velvet-cookie.png"],
    ["pecan", "products/pecan-cookie.png"],
  ] as const;

  for (const [id, key] of productPhotos) {
    await R2Object(`product-photo-${id}`, {
      bucket: media,
      key,
      content: readFileSync(new URL(`../../apps/web/public/${key}`, import.meta.url)),
      options: {
        httpMetadata: {
          contentType: "image/png",
        },
      },
    });
  }

  const web = await TanStackStart("web", {
    cwd: "../../apps/web",
    name: "sweettreats",
    url: true,
    bindings: {
      DB: db,
      MEDIA: media,
      ADMIN_EMAILS: adminEmails,
      CORS_ORIGIN: corsOrigin,
      ...(clerkPublishableKey ? { CLERK_PUBLISHABLE_KEY: clerkPublishableKey } : {}),
      ...(clerkSecretKey ? { CLERK_SECRET_KEY: alchemy.secret.env.CLERK_SECRET_KEY } : {}),
      ...(betterAuthSecret ? { BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET } : {}),
      ...(betterAuthUrl ? { BETTER_AUTH_URL: betterAuthUrl } : {}),
      ...(stripePublishableKey ? { STRIPE_PUBLISHABLE_KEY: stripePublishableKey } : {}),
      ...(stripeSecretKey ? { STRIPE_SECRET_KEY: alchemy.secret.env.STRIPE_SECRET_KEY } : {}),
    },
  });

  console.log(`Web    -> ${web.url}`);

  await app.finalize();
}
