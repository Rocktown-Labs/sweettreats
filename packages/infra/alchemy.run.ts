import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Stack } from "alchemy/Stack";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

/**
 * Prod keeps the original resource names so existing data/buckets are adopted
 * untouched. Every other stage (PR previews, dev) gets suffixed names so
 * preview code never reads or writes production data or media.
 */
const stageScopedName = (base: string) =>
  Stack.useSync((stack) => (stack.stage === "prod" ? base : `${base}-${stack.stage}`));

export const database = Cloudflare.D1.Database("database", {
  name: stageScopedName("sweettreats-db"),
  migrations: "../../packages/db/migrations",
});

export const media = Cloudflare.R2.Bucket("media", {
  name: stageScopedName("sweettreats-media"),
});

export const web = Cloudflare.Website.Vite(
  "web",
  Stack.useSync((stack) => {
    const isProd = stack.stage === "prod";
    const isDev = stack.stage.startsWith("dev_");

    // Production: apex + www alias
    // PR/preview stages: {stage}.sweettreatslr.com
    // Local dev: undefined (runs in local workerd)
    const domain = isProd
      ? {
          name: "sweettreatslr.com",
          aliases: ["www.sweettreatslr.com"],
        }
      : isDev
        ? undefined
        : `${stack.stage}.sweettreatslr.com`;

    return {
      name: isProd ? "sweettreats-prod" : `sweettreats-${stack.stage}`,
      rootDir: "../../apps/web",
      domain,
      workersDev: isDev ? true : false,
      env: {
        DB: database,
        MEDIA: media,
        ADMIN_EMAILS: Config.withDefault(
          Config.String("ADMIN_EMAILS"),
          "lauryan0311@gmail.com,admin@sweettreatslr.com,stlr@demo.com,cg@rocktownlabs.com",
        ),
        BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
        BETTER_AUTH_URL: Config.withDefault(
          Config.String("BETTER_AUTH_URL"),
          isProd ? "https://sweettreatslr.com" : `https://${stack.stage}.sweettreatslr.com`,
        ),
        RESEND_API_KEY: Config.withDefault(Config.Redacted("RESEND_API_KEY"), Redacted.make("")),
        RESEND_FROM_EMAIL: Config.withDefault(
          Config.String("RESEND_FROM_EMAIL"),
          "Sweet Treats LR <noreply@orders.sweettreatslr.com>",
        ),
        GOOGLE_CLIENT_ID: Config.withDefault(Config.String("GOOGLE_CLIENT_ID"), ""),
        GOOGLE_CLIENT_SECRET: Config.withDefault(
          Config.Redacted("GOOGLE_CLIENT_SECRET"),
          Redacted.make(""),
        ),
        STRIPE_SECRET_KEY: Config.withDefault(
          Config.Redacted("STRIPE_SECRET_KEY"),
          Redacted.make(""),
        ),
        STRIPE_PUBLISHABLE_KEY: Config.withDefault(Config.String("STRIPE_PUBLISHABLE_KEY"), ""),
        STRIPE_WEBHOOK_SECRET: Config.withDefault(
          Config.Redacted("STRIPE_WEBHOOK_SECRET"),
          Redacted.make(""),
        ),
        SHIPPO_API_KEY: Config.withDefault(Config.Redacted("SHIPPO_API_KEY"), Redacted.make("")),
      },
    };
  }),
);

export type WebEnv = Cloudflare.InferEnv<typeof web>;

export default Alchemy.Stack(
  "sweettreats",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const db = yield* database;
    const site = yield* web;
    const bucket = yield* media;

    return {
      databaseName: db.databaseName,
      mediaBucket: bucket.bucketName,
      url: site.url,
    };
  }),
);
