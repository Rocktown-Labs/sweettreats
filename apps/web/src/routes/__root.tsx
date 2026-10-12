import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@sweettreats/ui/components/sonner";
import { useState } from "react";

import Header from "../components/header";
import { CartProvider } from "../lib/cart";
import { getAuthRuntimeConfig } from "../lib/auth";
import appCss from "../index.css?url";

export interface RouterAppContext {}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      {
        name: "theme-color",
        content: "#fff8e7",
      },
      {
        title: "Sweet Treats LR",
      },
      {
        name: "description",
        content: "Sweet Treats LR mobile-first cookie shop and pickup ordering.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/sweet-treats-logo.png",
      },
    ],
  }),

  loader: () => getAuthRuntimeConfig(),
  component: RootDocument,
});

function RootDocument() {
  const [queryClient] = useState(() => new QueryClient());
  const app = (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <div className="app-shell">
          <Header />
          <Outlet />
        </div>
      </CartProvider>
    </QueryClientProvider>
  );

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {app}
        <Toaster richColors />
        {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-left" /> : null}
        <Scripts />
      </body>
    </html>
  );
}
