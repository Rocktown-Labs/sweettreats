import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@sweettreats/db";
import * as schema from "@sweettreats/db/schema/index";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { env } from "@sweettreats/env/server";

let authInstance: ReturnType<typeof betterAuth> | null = null;

function readEnv(key: string) {
  const processEnv = typeof process === "undefined" ? undefined : process.env[key];
  return String((env as Record<string, unknown>)[key] ?? processEnv ?? "");
}

export function getAuth() {
  if (!authInstance) {
    const db = createDb();
    const stripeSecretKey = readEnv("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = readEnv("STRIPE_WEBHOOK_SECRET") || "dummy";
    const stripeClient = stripeSecretKey
      ? new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" })
      : null;

    authInstance = betterAuth({
      baseURL: readEnv("BETTER_AUTH_URL") || undefined,
      secret: readEnv("BETTER_AUTH_SECRET") || undefined,
      database: drizzleAdapter(db, {
        provider: "sqlite",
        schema: {
          user: schema.user,
          session: schema.session,
          account: schema.account,
          verification: schema.verification,
        },
      }),
      emailAndPassword: {
        enabled: true,
      },
      plugins: [
        ...(stripeClient
          ? [
              stripe({
                stripeClient,
                stripeWebhookSecret,
                createCustomerOnSignUp: true,
              }),
            ]
          : []),
        tanstackStartCookies(),
      ],
    });
  }

  return authInstance;
}

export function adminEmails() {
  const envEmails = (env as Record<string, any>).ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
  return String(envEmails)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function currentUserEmail() {
  const { getRequestHeaders } = await import("@tanstack/react-start/server");
  const headers = getRequestHeaders();
  const auth = getAuth();
  if (!auth) {
    return { userId: null, email: null, role: null };
  }
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return { userId: null, email: null, role: null };
  }

  const email = session.user.email;
  const allowed = adminEmails();
  const isAdmin = email ? allowed.includes(email.toLowerCase()) : false;
  const role = isAdmin ? "admin" : null;

  return { userId: session.user.id, email, role };
}

export async function requireAdmin() {
  const { isAdminAuthDisabled, isAdminPreviewMode } = await import("./clerk-env");
  if (isAdminAuthDisabled() || isAdminPreviewMode()) {
    return;
  }

  const { email, role, userId } = await currentUserEmail();
  const allowed = adminEmails();
  const emailAllowed = email ? allowed.includes(email.toLowerCase()) : false;
  const roleAllowed = role === "admin" || role === "owner";

  if (!emailAllowed && !roleAllowed) {
    const { logger } = await import("./logger");
    logger.warn("admin.access_denied", { email, role, userId });
    throw new Error("Admin access required");
  }
}
