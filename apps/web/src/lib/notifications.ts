import { createDb } from "@sweettreats/db";
import { shopSettings } from "@sweettreats/db/schema/index";
import { eq, sql } from "drizzle-orm";

import { adminEmails } from "./auth-server";

/**
 * Order-notification recipients, decoupled from the ADMIN_EMAILS bootstrap
 * list. The admin sets the list in Admin → Integrations; empty falls back
 * to the deploy-time roster. Individual pickup locations with a contact
 * email still take precedence (vendor routing) — this is the shop-wide
 * fallback.
 */

const SETTINGS_KEY = "notifications";

export type NotificationSettings = {
  emails: string[];
};

export async function getOrderNotificationEmails(): Promise<string[]> {
  const db = createDb();
  try {
    const row = await db.query.shopSettings.findFirst({
      where: eq(shopSettings.key, SETTINGS_KEY),
    });
    if (row) {
      const parsed = JSON.parse(row.value) as Partial<NotificationSettings>;
      if (Array.isArray(parsed.emails)) {
        const emails = parsed.emails
          .filter((email): email is string => typeof email === "string")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 10);
        if (emails.length > 0) {
          return emails;
        }
      }
    }
  } catch {
    // Fall through to the deploy roster.
  }
  return adminEmails();
}

export async function saveOrderNotificationEmails(emails: string[]): Promise<void> {
  const db = createDb();
  const value = JSON.stringify({ emails } satisfies NotificationSettings);
  await db
    .insert(shopSettings)
    .values({ key: SETTINGS_KEY, value })
    .onConflictDoUpdate({
      target: shopSettings.key,
      set: { value, updatedAt: sql`CURRENT_TIMESTAMP` },
    });
}
