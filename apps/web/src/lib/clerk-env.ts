export function hasClerkAuthConfig() {
  return false;
}

export function isAdminPreviewMode() {
  const isPreview = process.env.ADMIN_PREVIEW_MODE === "1";
  return Boolean(isPreview);
}

export function isAdminAuthDisabled() {
  // Temporary handoff/testing bypass is disabled because Better Auth is fully configured.
  return false;
}
