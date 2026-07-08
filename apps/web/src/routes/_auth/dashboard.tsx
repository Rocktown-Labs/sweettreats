import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "../../lib/auth-client";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: session } = authClient.useSession();
  const displayName = session?.user?.name || session?.user?.email || "User";

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>Welcome {displayName}</p>
    </div>
  );
}
