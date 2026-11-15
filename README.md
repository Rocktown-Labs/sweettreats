# Sweet Treats Little Rock

<div align="center">
  <h3>A Little Rock bakery storefront, from today's menu to pickup or shipping</h3>
  <p>Browse treats, build an order, check out, and keep order details together in one customer account.</p>
</div>

[sweettreatslr.com](https://sweettreatslr.com)

---

## 1. Product Overview

**Sweet Treats Little Rock** is an online storefront and order-management application for the Sweet Treats bakery. Customers can browse the catalog and daily menu, view item details, add products to a cart, complete checkout, and return to their order history. The admin workspace supports the operations behind that storefront, including items, daily menus, orders, customers, carts, locations, shipping, and store settings.

## 2. System Architecture & Technology

| Layer | Technologies |
| --- | --- |
| Web application | React, TanStack Start, TanStack Router |
| Client data | TanStack Query and TanStack DB |
| Database | Drizzle ORM with Cloudflare D1 / SQLite |
| Authentication | Better Auth |
| UI | Tailwind CSS v4 and shared shadcn-style components |
| Infrastructure | Alchemy and Cloudflare |
| Workspace | Bun and Vite+ |

At runtime, the application uses the Cloudflare `DB` binding defined by the infrastructure package. The Drizzle configuration loads `apps/web/.env` for schema and migration tooling; `bun run db:generate` generates migration artifacts and does not connect to a database. Alchemy provisions D1 and applies migrations during infrastructure development and deployment.

## 3. Storefront Capabilities

### Customer shopping

- Browse the product catalog and daily menu.
- Open item pages for product details.
- Add items to a persistent cart and proceed through checkout.
- See order confirmation after a successful order.
- Sign in or create an account and view previous orders.
- Use location and shipping options configured by the store.

### Store operations

The administration area includes dedicated screens for:

- **Catalog and items:** create and maintain products and item details.
- **Daily menu:** manage the menu presented to customers.
- **Orders:** review orders and inspect individual order details.
- **Customers and carts:** look up customer records and active carts.
- **Locations and shipping:** maintain store locations and fulfillment settings.
- **Settings:** manage storefront configuration.

### Notifications and live updates

The web workspace includes a realtime notification center and publish/guard utilities. These support in-app operations notifications while keeping realtime event handling within the web application.

## 4. Monorepo Structure

```text
sweettreats/
├── apps/
│   └── web/                 # Storefront, account pages, checkout, and admin tools
├── packages/
│   ├── config/              # Shared TypeScript configuration
│   ├── db/                  # Drizzle schema and migrations
│   ├── email/               # Email templates and delivery helpers
│   ├── env/                 # Environment validation
│   ├── infra/               # Alchemy and Cloudflare resources
│   └── ui/                  # Shared UI primitives
├── package.json
└── bunfig.toml
```

## 5. Local Development

### Prerequisites

- Bun 1.3.14
- Cloudflare / Alchemy credentials only when working with remote or deployed resources

Install the dependencies:

```bash
bun install
```

The root `bun run dev` command starts local Alchemy infrastructure and the React Email preview; it does not start the storefront. To serve the storefront directly, run:

```bash
bun --filter web dev:bare
```

This starts the web application at `http://localhost:3001/`. For a local Cloudflare runtime, use the configured Cloudflare development script after setting up the required environment.

Generate database migration artifacts with:

```bash
bun run db:generate
```

For local Alchemy development, create `apps/web/.env` and set `BETTER_AUTH_SECRET` to a stable random value (for example, generate one with `openssl rand -base64 32`). The application also reads local Worker secrets from `apps/web/.dev.vars` when running through Wrangler. No example environment file is tracked in this repository. Do not commit either file, provider tokens, or customer data.

## 6. Useful Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start all configured development workspaces |
| `bun --filter web dev:bare` | Start the storefront at `http://localhost:3001/` |
| `bun run dev:cf` | Run the web app in the Cloudflare development runtime |
| `bun run build` | Build configured workspaces |
| `bun run check-types` | Run workspace type checks |
| `bun run check` | Run Oxlint and Oxfmt |
| `bun run test` | Run configured package tests |
| `bun run db:generate` | Generate database migration artifacts |
| `bun run deploy` | Deploy through the Alchemy infrastructure workspace |
| `bun run destroy` | Destroy the selected infrastructure stage |

## 7. Deployment & Data

Cloudflare resources and deployment behavior are defined in `packages/infra`. The D1 database is created and migrated through Alchemy. Use the deployment scripts and the appropriate stage configuration for preview or production work; use `destroy` only for a stage you intend to remove.

The app's schema and migrations live under `packages/db`. Runtime database access uses the Cloudflare `DB` binding. The Drizzle configuration loads `apps/web/.env`; generating migrations does not open a database connection.

## 8. Quality Checks

```bash
bun run check
bun run check-types
bun run test
bun run build
```

<div align="center">
  <sub>Made for Sweet Treats Little Rock and its customers.</sub>
</div>
