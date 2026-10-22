import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@sweettreats/db";
import * as schema from "@sweettreats/db/schema/index";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { stripe } from "@better-auth/stripe";
import { magicLink } from "better-auth/plugins";
import { sendMagicLinkEmail, sendVerifyEmail } from "@sweettreats/email";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { env } from "@sweettreats/env/server";
import { logger } from "./logger";
import { clientIpFromHeaders, rateLimit } from "./rate-limit";
import { enqueueEmail } from "./outbox";

let authInstance: any = null;

function readEnv(key: string) {
  const processEnv = typeof process === "undefined" ? undefined : process.env[key];
  return String((env as Record<string, unknown>)[key] ?? processEnv ?? "");
}

/**
 * Admin allowlist from environment. This is a bootstrap list only: the
 * first verified sign-in with a listed email is promoted to role=admin in
 * the database, and the database is the source of truth from then on.
 * Set role='customer' in the DB to explicitly revoke someone.
 */
export function adminEmails() {
  const envEmails = (env as Record<string, any>).ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
  return String(envEmails)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Rate limit an outbound auth email (magic link or verification) per IP address. */
async function limitAuthEmail(kind: "magic-link" | "verify-email"): Promise<boolean> {
  const db = createDb();
  const { getRequestHeaders } = await import("@tanstack/react-start/server");
  const ip = clientIpFromHeaders(getRequestHeaders());
  const { ok } = await rateLimit(db, `auth-email-${kind}`, ip, 60 * 60, 10);
  if (!ok) {
    logger.warn("auth.email_rate_limited", { kind, ip: ip === "unknown" ? undefined : ip });
  }
  return ok;
}

export function getAuth(): ReturnType<typeof betterAuth> {
  if (!authInstance) {
    const db = createDb();
    const stripeSecretKey = readEnv("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = readEnv("STRIPE_WEBHOOK_SECRET") || "dummy";
    const stripeClient = stripeSecretKey
      ? new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" as any })
      : null;

    const googleClientId = readEnv("GOOGLE_CLIENT_ID");
    const googleClientSecret = readEnv("GOOGLE_CLIENT_SECRET");

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
      user: {
        additionalFields: {
          role: {
            type: "string",
            required: false,
            // No persisted default: new accounts must keep role NULL so the
            // ADMIN_EMAILS bootstrap can promote them on first verified
            // sign-in. A persisted "customer" default would short-circuit
            // promotion (see resolveUserRole). Demote someone by explicitly
            // setting role='customer' in the database.
            input: false,
          },
        },
      },
      databaseHooks: {
        user: {
          create: {
            after: async (newUser) => {
              // Welcome email through the transactional outbox: the row is
              // durable immediately, the queue drains it, the cron re-drains
              // anything pending — never silently lost.
              try {
                await enqueueEmail(createDb(), "welcome", { userId: newUser.id });
                logger.info("outbox.welcome_enqueued", { userId: newUser.id });
              } catch (err) {
                logger.error("outbox.welcome_enqueue_failed", {
                  userId: newUser.id,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            },
          },
        },
      },
      emailAndPassword: {
        enabled: true,
        // Registration without proving inbox ownership would let anyone claim
        // an admin email and immediately match the admin allowlist bootstrap.
        requireEmailVerification: true,
        minPasswordLength: 8,
      },
      emailVerification: {
        enabled: true,
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          const allowed = await limitAuthEmail("verify-email");
          if (!allowed) {
            throw new Error("Too many verification emails requested. Try again in an hour.");
          }
          await sendVerifyEmail(
            { url, email: user.email },
            {
              to: user.email,
              apiKey: readEnv("RESEND_API_KEY"),
              from:
                readEnv("RESEND_FROM_EMAIL") ||
                "Sweet Treats LR <noreply@orders.sweettreatslr.com>",
            },
          );
        },
      },
      socialProviders:
        googleClientId && googleClientSecret
          ? {
              google: {
                clientId: googleClientId,
                clientSecret: googleClientSecret,
              },
            }
          : undefined,
      plugins: [
        magicLink({
          sendMagicLink: async ({ email, url }) => {
            const allowed = await limitAuthEmail("magic-link");
            if (!allowed) {
              throw new Error("Too many sign-in links requested. Try again in an hour.");
            }
            await sendMagicLinkEmail(
              { url, email },
              {
                to: email,
                apiKey: readEnv("RESEND_API_KEY"),
                from:
                  readEnv("RESEND_FROM_EMAIL") ||
                  "Sweet Treats LR <noreply@orders.sweettreatslr.com>",
              },
            );
          },
        }),
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
  const role = await resolveUserRole(session.user.id, email);

  return { userId: session.user.id, email, role };
}

/**
 * Resolve a user's role from the database. A user whose email is in the
 * ADMIN_EMAILS bootstrap list is promoted to admin on their first *verified*
 * sign-in; an explicitly-set role is never overwritten by the bootstrap.
 * Exported for the realtime WebSocket gate, which authenticates a raw
 * Request outside server-fn context.
 */
export async function resolveUserRole(
  userId: string,
  email: string | null,
): Promise<string | null> {
  const db = createDb();
  const row = await db.query.user.findFirst({
    where: eq(schema.user.id, userId),
    columns: { role: true, emailVerified: true },
  });

  if (row?.role) {
    return row.role;
  }

  const isAdminCandidate = email ? adminEmails().includes(email.toLowerCase()) : false;
  if (row && isAdminCandidate && row.emailVerified) {
    await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, userId));
    logger.info("admin.role_promoted", { userId });
    return "admin";
  }

  return null;
}

/** Session-aware admin check. Returns a plain boolean — never leaks the admin list. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { userId, role } = await currentUserEmail();
  return Boolean(userId) && (role === "admin" || role === "owner");
}

export async function requireAdmin() {
  const { email, role, userId } = await currentUserEmail();

  if (role === "admin" || role === "owner") {
    return;
  }

  logger.warn("admin.access_denied", { email, role, userId });
  throw new Error("Admin access required");
}
