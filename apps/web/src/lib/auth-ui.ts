/**
 * Shared helpers for the sign-in / sign-up flows.
 */

type AuthError = {
  message?: string;
  code?: string;
  status?: number;
} | null;

/**
 * Only allow same-site relative paths as post-auth destinations so a crafted
 * `?redirect=https://evil.example` link can't bounce users off-site.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/") {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }

  return target;
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match. Double-check and try again.",
  INVALID_EMAIL: "Enter a valid email address.",
  USER_ALREADY_EXISTS: "An account with that email already exists. Try logging in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "An account with that email already exists. Try logging in instead.",
  PASSWORD_TOO_SHORT: "Use a password with at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is too long. Use 128 characters or fewer.",
  EMAIL_NOT_VERIFIED: "Please verify your email before logging in.",
};

export function authErrorMessage(error: AuthError, fallback: string) {
  if (!error) {
    return fallback;
  }

  if (error.code && FRIENDLY_MESSAGES[error.code]) {
    return FRIENDLY_MESSAGES[error.code];
  }

  if (error.status === 429) {
    return "Too many attempts. Wait a minute and try again.";
  }

  if (error.status && error.status >= 500) {
    return "Something went wrong on our end. Please try again in a moment.";
  }

  return error.message || fallback;
}

/** Network failures surface as thrown TypeErrors rather than `{ error }` results. */
export function caughtAuthMessage(caught: unknown, fallback: string) {
  if (caught instanceof TypeError) {
    return "Can't reach the server. Check your connection and try again.";
  }

  return caught instanceof Error && caught.message ? caught.message : fallback;
}
