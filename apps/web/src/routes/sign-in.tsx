import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

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
      const { error: authError } = await authClient.signIn.email({ email, password });

      if (authError) {
        setError(authErrorMessage(authError, "Failed to sign in. Please check your credentials."));
        return;
      }

      toast.success("Welcome back!");
      // Everyone lands back on the storefront unless they were sent here from a protected page.
      await navigate({ to: safeRedirect(redirect), replace: true });
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
          Log In
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            textAlign: "center",
            margin: "8px 0 24px",
          }}
        >
          Welcome back
        </h1>

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
            style={{ marginTop: "8px", width: "100%" }}
          >
            {isLoading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "0.9rem" }} className="muted">
          Don&apos;t have an account?{" "}
          <Link to="/sign-up" search={{ redirect }} className="text-link">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}
