import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Stack } from "alchemy/Stack";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

import type { NotificationCenter } from "../../apps/web/src/realtime/notification-center";

/**
 * Prod keeps the original resource names so existing data/buckets are adopted
 * untouched. Every other stage (PR previews, dev) gets suffixed names so
 * preview code never reads or writes production data or media.
 */
const stageScopedName = (base: string) =>
  Stack.useSync((stack) => (stack.stage === "prod" ? base : `${base}-${stack.stage}`));

export const database = Cloudflare.D1.Database("database", {
  name: stageScopedName("sweettreats-db"),
  // Flat copy of packages/db/src/migrations — deliberately NOT the drizzle
  // source dir. Alchemy hard-fails on drizzle's v0 layout (meta/_journal.json,
  // DrizzleV0LayoutError); it needs a flat folder of .sql files. The copy is
  // kept in sync by `db:generate` (scripts/sync-migrations.mjs).
  migrations: "../../packages/db/migrations",
});

export const media = Cloudflare.R2.Bucket("media", {
  name: stageScopedName("sweettreats-media"),
});

// NOTE: the queue name must be a plain string, not Stack.useSync-derived.
// useSync returns a lazy proxy in this context that serializes to {} in
// request bodies (the Queues create call is the first place a resource name
// travels in a request BODY — D1/R2 names only ever match state). Until the
// upstream behavior is fixed, preview stages get their own literal names.
export const emailQueue = Cloudflare.Queues.Queue("emailQueue", {
  name: "sweettreats-email",
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
      // Custom entry: the framework server bundle only exports fetch, but
      // the worker also hosts the email queue consumer and the hourly cron.
      main: "workers/entry.ts",
      // Hourly maintenance: stale-order sweep, outbox drain, abandoned-cart
      // win-back emails, rate-limit pruning.
      crons: ["0 * * * *"],
      env: {
        DB: database,
        MEDIA: media,
        // Realtime admin badge fan-out. The class is exported from the
        // worker entry; Alchemy derives the class migration automatically.
        NOTIFICATIONS: Cloudflare.DurableObject<NotificationCenter>("NOTIFICATIONS", {
          className: "NotificationCenter",
        }),
        // Producer binding lives on prod only; preview workers enqueue
        // through the cron drain instead of racing prod's single consumer.
        ...(isProd ? { EMAIL_QUEUE: emailQueue } : {}),
        ADMIN_EMAILS: Config.withDefault(
          Config.String("ADMIN_EMAILS"),
          "lauryan0311@gmail.com,admin@sweettreatslr.com",
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
        SHIPPO_WEBHOOK_TOKEN: Config.withDefault(
          Config.Redacted("SHIPPO_WEBHOOK_TOKEN"),
          Redacted.make(""),
        ),
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

    const stage = yield* Stack.use((stack) => Effect.succeed(stack.stage));
    if (stage === "prod") {
      // The web worker's queue() handler drains the email outbox. Queues
      // allow exactly one Worker consumer — previews must never re-point it.
      const queue = yield* emailQueue;
      yield* Cloudflare.Queues.Consumer("emailQueueConsumer", {
        queueId: queue.queueId,
        scriptName: site.workerName,
        settings: {
          batchSize: 10,
          maxRetries: 3,
          maxWaitTimeMs: 5000,
        },
      });
      return {
        databaseName: db.databaseName,
        mediaBucket: bucket.bucketName,
        emailQueue: queue.queueName,
        url: site.url,
      };
    }

    return {
      databaseName: db.databaseName,
      mediaBucket: bucket.bucketName,
      url: site.url,
    };
  }),
);
