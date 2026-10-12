import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDb, schema } from "@sweettreats/db";
import { env } from "@sweettreats/env/server";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  database: drizzleAdapter(createDb(), {
    provider: "sqlite",
    schema,
  }),
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies()],
});
