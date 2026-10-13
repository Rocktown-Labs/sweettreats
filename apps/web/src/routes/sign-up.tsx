import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { authClient } from "../lib/auth-client";
import { authErrorMessage, caughtAuthMessage, safeRedirect } from "../lib/auth-ui";

export const Route = createFileRoute("/sign-up")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: SignUpPage,
});

const MIN_PASSWORD_LENGTH = 8;

function SignUpPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { error: authError } = await authClient.signUp.email({ email, password, name });

      if (authError) {
        setError(authErrorMessage(authError, "Failed to create account."));
        return;
      }

      // With email verification required, sign-up creates the account but no
      // session: point the user at their inbox instead of a logged-in page.
      toast.success("Account created! Check your inbox to verify your email.");
      await navigate({ to: "/sign-in", replace: true });
    } catch (caught) {
      setError(caughtAuthMessage(caught, "An unexpected error occurred."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="panel auth-panel" style={{ padding: "24px" }}>
        <p className="eyebrow" style={{ textAlign: "center" }}>
          Sign Up
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            textAlign: "center",
            margin: "8px 0 24px",
          }}
        >
          Create an account
        </h1>

        <p
          className="muted"
          style={{ textAlign: "center", marginTop: "-16px", fontSize: "0.86rem" }}
        >
          We&apos;ll email you a verification link after sign-up.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: "16px", width: "100%" }}
          aria-busy={isLoading}
        >
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <label className="field">
            <span>Full Name</span>
            <input
              type="text"
              name="name"
              required
              autoComplete="name"
              enterKeyHint="next"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              disabled={isLoading}
            />
          </label>

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
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              aria-describedby="password-hint"
            />
            <small id="password-hint" className="field-hint">
              At least {MIN_PASSWORD_LENGTH} characters.
            </small>
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={isLoading}
            style={{ marginTop: "8px", width: "100%" }}
          >
            {isLoading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", margin: "20px 0", color: "#a88e6e" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#ead8bf" }} />
          <span style={{ padding: "0 10px", fontSize: "0.8rem", textTransform: "uppercase" }}>
            or
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#ead8bf" }} />
        </div>

        <button
          type="button"
          onClick={async () => {
            if (isLoading) return;
            setError("");
            setLoading(true);
            try {
              await authClient.signIn.social({
                provider: "google",
                callbackURL: safeRedirect(redirect),
              });
            } catch {
              setError("Google sign-in is not connected yet. Please sign up with email.");
              setLoading(false);
            }
          }}
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

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "0.9rem" }} className="muted">
          Already have an account?{" "}
          <Link to="/sign-in" search={{ redirect }} className="text-link">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
