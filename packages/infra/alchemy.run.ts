import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Stack } from "alchemy/Stack";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

export const database = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
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
      rootDir: "../../apps/web",
      domain,
      workersDev: isDev ? true : false,
      env: {
        DB: database,
        CORS_ORIGIN: Config.withDefault(
          Config.String("CORS_ORIGIN"),
          isProd ? "https://sweettreatslr.com" : `https://${stack.stage}.sweettreatslr.com`,
        ),
        BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
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

    return {
      databaseName: db.databaseName,
      url: site.url,
    };
  }),
);
