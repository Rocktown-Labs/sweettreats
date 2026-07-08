import { Outlet, createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "../../lib/auth-client";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <div className="p-6">Loading...</div>;
  }

  if (!session?.user) {
    return (
      <div className="p-6 text-center space-y-4">
        <p>Please log in to view this page.</p>
        <Link to="/sign-in" className="primary-button inline-flex">
          Log in
        </Link>
      </div>
    );
  }

  return <Outlet />;
}
