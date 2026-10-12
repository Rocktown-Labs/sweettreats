import { env } from "@sweettreats/env/server";

export function hasClerkAuthConfig() {
  return Boolean(env.CLERK_SECRET_KEY && env.CLERK_PUBLISHABLE_KEY);
}

export function isAdminPreviewMode() {
  const runtimeEnv = env as unknown as Record<string, unknown>;
  const isPreview = runtimeEnv.ADMIN_PREVIEW_MODE === "1" || process.env.ADMIN_PREVIEW_MODE === "1";
  return Boolean(isPreview && !hasClerkAuthConfig());
}

export function isAdminAuthDisabled() {
  // Temporary handoff/testing bypass is disabled because Better Auth is fully configured.
  return false;
}
