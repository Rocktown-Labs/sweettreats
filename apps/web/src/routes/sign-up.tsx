import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/sign-up")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name,
        callbackURL: redirect ?? "/admin",
      });

      if (error) {
        toast.error(error.message || "Failed to create account.");
      } else {
        toast.success("Account created successfully!");
        navigate({ to: redirect ?? "/admin" });
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "An unexpected error occurred.");
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

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px", width: "100%" }}>
          <label className="field">
            <span>Full Name</span>
            <input
              type="text"
              required
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
              required
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
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
            />
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
