import { Button } from "@sweettreats/ui/components/button";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { authClient, useSession } from "../../utils/auth-client";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { data: session, isPending } = useSession();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPending) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  if (!session) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      if (isSignUp) {
        const res = await authClient.signUp.email({
          email,
          password,
          name,
        });
        if (res.error) {
          setError(res.error.message || "Failed to sign up");
        }
      } else {
        const res = await authClient.signIn.email({
          email,
          password,
        });
        if (res.error) {
          setError(res.error.message || "Failed to sign in");
        }
      }
      setLoading(false);
    };

    return (
      <div className="mx-auto max-w-sm space-y-4 p-6">
        <h2 className="text-2xl font-bold">{isSignUp ? "Create an Account" : "Sign In"}</h2>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border bg-background px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border bg-background px-3 py-2 text-sm"
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-primary underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    );
  }

  return <Outlet />;
}
