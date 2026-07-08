import { Link, useNavigate, useLoaderData } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

import { useCart } from "../lib/cart";
import { authClient } from "../lib/auth-client";

export default function Header() {
  const cart = useCart();
  const links = [
    { to: "/", label: "Home" },
    { to: "/menu", label: "Menu" },
  ] as const;

  return (
    <header className="site-header">
      <Link to="/" className="brand-lockup">
        <img src="/sweet-treats-logo.png" alt="Sweet Treats LR" className="brand-logo" />
        <span>
          <strong>Sweet Treats LR</strong>
        </span>
      </Link>
      <nav className="site-nav">
        {links.map(({ to, label }) => {
          return (
            <Link key={to} to={to}>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="header-actions">
        <Link to="/cart" className="cart-pill" aria-label="Open cart">
          <ShoppingBag size={18} />
          <span>{cart.count}</span>
        </Link>
        <HeaderAuthControls />
      </div>
    </header>
  );
}

function HeaderAuthControls() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const rootData = useLoaderData({ from: "__root__", strict: false }) as { adminEmails?: string[] };

  if (isPending) {
    return (
      <span className="text-button" style={{ opacity: 0.7 }}>
        ...
      </span>
    );
  }

  if (session?.user) {
    const isAdmin =
      session.user.email && rootData?.adminEmails?.includes(session.user.email.toLowerCase());
    return (
      <>
        {isAdmin && (
          <Link to="/admin" className="text-button account-link">
            Admin
          </Link>
        )}
        <Link to="/account/orders" className="text-button account-link">
          Orders
        </Link>
        <button
          type="button"
          className="text-button"
          onClick={async () => {
            await authClient.signOut();
            navigate({ to: "/" });
          }}
        >
          Log out
        </button>
      </>
    );
  }

  return (
    <Link to="/sign-in" className="text-button">
      Log in
    </Link>
  );
}
