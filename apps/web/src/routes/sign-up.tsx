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

      toast.success("Account created successfully!");
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
