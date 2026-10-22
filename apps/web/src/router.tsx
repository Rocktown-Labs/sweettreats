import { createRouter as createTanStackRouter, Link } from "@tanstack/react-router";

import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";

function NotFound() {
  return (
    <main className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">404</p>
          <h1 className="page-title">Not found</h1>
        </div>
      </div>
      <section className="panel empty-state">
        <p>This page doesn&apos;t exist — it may have moved, or the link was mistyped.</p>
        <Link to="/menu" className="primary-button" style={{ marginTop: "14px" }}>
          Browse the menu
        </Link>
      </section>
    </main>
  );
}

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: {},
    defaultPendingComponent: () => <Loader />,
    defaultPendingMs: 100,
    defaultPendingMinMs: 300,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: () => <div>Something went wrong.</div>,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
