import { createFileRoute, redirect } from "@tanstack/react-router";

// The standalone dashboard was never used; the customer dashboard lives at /account/orders.
// Keep the old URL working so bookmarks and stale links land in the right place.
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/account/orders", replace: true });
  },
});
