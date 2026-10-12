import { Button } from "@sweettreats/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { authClient, useSession } from "../../utils/auth-client";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: session } = useSession();
  const displayName = session?.user?.name || session?.user?.email || "User";

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>Welcome, {displayName}!</p>
      <Button
        variant="outline"
        onClick={async () => {
          await authClient.signOut();
        }}
      >
        Sign Out
      </Button>
    </div>
  );
}
