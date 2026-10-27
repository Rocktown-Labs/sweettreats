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

const bakerySchema = {
  "@context": "https://schema.org",
  "@type": "Bakery",
  name: "Sweet Treats LR",
  image: "https://sweettreatslr.com/og-image.png",
  logo: "https://sweettreatslr.com/sweet-treats-logo.png",
  url: "https://sweettreatslr.com",
  description:
    "Artisanal fresh-baked cookies, cookie jars, and daily treats in Little Rock, Arkansas. Order online today for quick pickup across Downtown and West Little Rock!",
  priceRange: "$",
  servesCuisine: ["Bakery", "Cookies", "Desserts"],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Little Rock",
    addressRegion: "AR",
    addressCountry: "US",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "11:00",
      closes: "23:00",
    },
  ],
  sameAs: ["https://instagram.com/sweettreatslr"],
};

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
        title: "Sweet Treats LR • Cookies, Cakes, Shakes & More",
      },
      {
        name: "description",
        content:
          "Artisanal fresh-baked cookies, custom cakes, signature shakes, and handcrafted treats in Little Rock and North Little Rock. Order online today for quick pickup!",
      },
      {
        name: "keywords",
        content:
          "cookies Little Rock, cakes Little Rock, shakes Little Rock, bakery North Little Rock, Sweet Treats LR, fresh baked cookies, Central Arkansas dessert pickup",
      },
      // Open Graph
      {
        property: "og:site_name",
        content: "Sweet Treats LR",
      },
      {
        property: "og:title",
        content: "Sweet Treats LR • Cookies, Cakes, Shakes & More",
      },
      {
        property: "og:description",
        content:
          "Artisanal fresh-baked cookies, custom cakes, signature shakes, and handcrafted treats in Little Rock and North Little Rock. Order online today for quick pickup!",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:url",
        content: "https://sweettreatslr.com",
      },
      {
        property: "og:image",
        content: "https://sweettreatslr.com/og-image.png",
      },
      {
        property: "og:image:secure_url",
        content: "https://sweettreatslr.com/og-image.png",
      },
      {
        property: "og:image:type",
        content: "image/png",
      },
      {
        property: "og:image:width",
        content: "1200",
      },
      {
        property: "og:image:height",
        content: "630",
      },
      {
        property: "og:image:alt",
        content:
          "Sweet Treats LR - Cookies, Cakes, Shakes & More in Little Rock & North Little Rock",
      },
      {
        property: "og:locale",
        content: "en_US",
      },
      // Twitter Card
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:site",
        content: "@sweettreatslr",
      },
      {
        name: "twitter:creator",
        content: "@sweettreatslr",
      },
      {
        name: "twitter:title",
        content: "Sweet Treats LR • Cookies, Cakes, Shakes & More",
      },
      {
        name: "twitter:description",
        content:
          "Artisanal cookies, custom cakes, signature shakes, and daily treats in Little Rock and North Little Rock. Order online for pickup!",
      },
      {
        name: "twitter:image",
        content: "https://sweettreatslr.com/og-image.png",
      },
      {
        name: "twitter:image:alt",
        content: "Sweet Treats LR - Cookies, Cakes, Shakes & More",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "canonical",
        href: "https://sweettreatslr.com",
      },
      {
        rel: "icon",
        href: "/sweet-treats-logo.png",
      },
      {
        rel: "apple-touch-icon",
        href: "/sweet-treats-logo.png",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(bakerySchema),
      },
      {
        children:
          "window.traks=window.traks||function(){(window.traks.q=window.traks.q||[]).push(arguments)}",
      },
      {
        defer: true,
        src: "https://traks-collect.rocktown-labs.workers.dev/t.js",
        "data-site": "pb_live_flxq80ww875wmua698zxjs77",
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
