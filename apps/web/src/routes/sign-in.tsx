import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, KeyRound, Sparkles } from "lucide-react";

import { authClient } from "../lib/auth-client";
import { authErrorMessage, caughtAuthMessage, safeRedirect } from "../lib/auth-ui";

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: SignInPage,
});

function SignInPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState<"magic-link" | "password">("magic-link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { error: authError } = await authClient.signIn.email({ email, password });

      if (authError) {
        setError(authErrorMessage(authError, "Failed to sign in. Please check your credentials."));
        return;
      }

      toast.success("Welcome back!");
      await navigate({ to: safeRedirect(redirect), replace: true });
    } catch (caught) {
      setError(caughtAuthMessage(caught, "An unexpected error occurred."));
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading || !email.trim()) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { error: authError } = await (authClient.signIn as any).magicLink({
        email: email.trim(),
        callbackURL: safeRedirect(redirect),
      });

      if (authError) {
        setError(authErrorMessage(authError, "Failed to send sign-in link."));
        return;
      }

      setMagicLinkSent(true);
      toast.success("Sign-in link sent to your email!");
    } catch (caught) {
      setError(caughtAuthMessage(caught, "Could not send sign-in link."));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setError("");
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: safeRedirect(redirect),
      });
    } catch {
      setError("Google sign-in is not connected yet. Please sign in with email.");
      setLoading(false);
    }
  };

  const isDemoEmail = email.toLowerCase().trim() === "stlr@demo.com";

  return (
    <main className="auth-page">
      <section
        className="panel auth-panel"
        style={{ padding: "28px", maxWidth: "440px", margin: "0 auto" }}
      >
        <p className="eyebrow" style={{ textAlign: "center" }}>
          Account Access
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            textAlign: "center",
            margin: "8px 0 20px",
          }}
        >
          Welcome back
        </h1>

        {/* Auth Method Switcher */}
        <div
          role="tablist"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            backgroundColor: "#f5ede1",
            padding: "4px",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={authMethod === "magic-link"}
            onClick={() => {
              setAuthMethod("magic-link");
              setError("");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "8px 12px",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.88rem",
              fontWeight: authMethod === "magic-link" ? 700 : 500,
              backgroundColor: authMethod === "magic-link" ? "#ffffff" : "transparent",
              color: authMethod === "magic-link" ? "#241408" : "#8c6f4a",
              boxShadow: authMethod === "magic-link" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              cursor: "pointer",
            }}
          >
            <Sparkles size={15} />
            <span>Magic link</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMethod === "password"}
            onClick={() => {
              setAuthMethod("password");
              setError("");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "8px 12px",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.88rem",
              fontWeight: authMethod === "password" ? 700 : 500,
              backgroundColor: authMethod === "password" ? "#ffffff" : "transparent",
              color: authMethod === "password" ? "#241408" : "#8c6f4a",
              boxShadow: authMethod === "password" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              cursor: "pointer",
            }}
          >
            <KeyRound size={15} />
            <span>Password</span>
          </button>
        </div>

        {error ? (
          <p className="form-error" role="alert" style={{ marginBottom: "16px" }}>
            {error}
          </p>
        ) : null}

        {isDemoEmail ? (
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "#fff8e7",
              border: "1px solid #f6c453",
              borderRadius: "8px",
              fontSize: "0.85rem",
              color: "#6b5847",
              marginBottom: "16px",
              lineHeight: "1.4",
            }}
          >
            <strong>Legacy Demo Notice:</strong> <code>stlr@demo.com</code> is a demo account. The
            official administrator email is <strong>lauryan0311@gmail.com</strong> or{" "}
            <strong>admin@sweettreatslr.com</strong>.
          </div>
        ) : null}

        {/* Magic Link Form */}
        {authMethod === "magic-link" ? (
          magicLinkSent ? (
            <div
              style={{
                backgroundColor: "#fff8e7",
                padding: "20px",
                borderRadius: "12px",
                textAlign: "center",
                border: "1px solid #f6c453",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>✉️</div>
              <h3 style={{ margin: "0 0 8px 0", color: "#241408", fontSize: "1.1rem" }}>
                Check your inbox!
              </h3>
              <p
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "0.9rem",
                  color: "#5c4939",
                  lineHeight: "1.5",
                }}
              >
                We sent a secure, passwordless sign-in link to <strong>{email}</strong>. Click the
                link in your email to instantly log in.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setMagicLinkSent(false)}
                style={{ fontSize: "0.85rem" }}
              >
                Send again or try another email
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleMagicLinkSubmit}
              style={{ display: "grid", gap: "16px", width: "100%" }}
              aria-busy={isLoading}
            >
              <label className="field">
                <span>Email Address</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isLoading}
                  aria-invalid={error ? true : undefined}
                />
              </label>

              <button
                type="submit"
                className="primary-button"
                disabled={isLoading}
                style={{
                  marginTop: "4px",
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <Mail size={18} />
                <span>{isLoading ? "Sending link..." : "Email me a sign-in link"}</span>
              </button>
            </form>
          )
        ) : (
          /* Password Form */
          <form
            onSubmit={handlePasswordSubmit}
            style={{ display: "grid", gap: "16px", width: "100%" }}
            aria-busy={isLoading}
          >
            <label className="field">
              <span>Email Address</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isLoading}
                aria-invalid={error ? true : undefined}
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                enterKeyHint="go"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                aria-invalid={error ? true : undefined}
              />
            </label>

            <button
              type="submit"
              className="primary-button"
              disabled={isLoading}
              style={{ marginTop: "4px", width: "100%" }}
            >
              {isLoading ? "Logging in..." : "Log in"}
            </button>
          </form>
        )}

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", margin: "20px 0", color: "#a88e6e" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#ead8bf" }} />
          <span style={{ padding: "0 10px", fontSize: "0.8rem", textTransform: "uppercase" }}>
            or
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#ead8bf" }} />
        </div>

        {/* Google Social Sign In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "10px 16px",
            backgroundColor: "#ffffff",
            border: "1px solid #d4c1aa",
            borderRadius: "10px",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "#241408",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.9rem" }} className="muted">
          Don&apos;t have an account?{" "}
          <Link to="/sign-up" search={{ redirect }} className="text-link">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}
